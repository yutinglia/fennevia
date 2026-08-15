import assert from "node:assert/strict";
import test from "node:test";

import { maximumDownloadItems } from "../src/app/download-state.ts";
import {
  createFirefoxBridgeBoundary,
  isFirefoxBridgeError,
} from "../src/firefox/bridge-boundary.ts";
import { createFirefoxDownloadsBridge } from "../src/firefox/downloads.ts";

const BROWSER_URI = "chrome://browser/content/browser.xhtml";
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

function createNativeWindow() {
  const document = { defaultView: null, documentURI: BROWSER_URI };
  const window = {
    document,
    gBrowser: {
      selectedBrowser: { webNavigation: {} },
      tabContainer: createEventTarget(),
      tabs: [],
    },
  };
  document.defaultView = window;
  return window;
}

function download(overrides = {}) {
  return {
    canceled: false,
    currentBytes: 0,
    error: null,
    hasPartialData: false,
    hasProgress: true,
    progress: 0,
    source: {
      isPrivate: false,
      referrerInfo: { secret: "referrer" },
      url: "https://private.example.invalid/secret-source",
    },
    stopped: false,
    succeeded: false,
    target: { path: "C:\\Users\\person\\Downloads\\secret-name.zip" },
    totalBytes: 100,
    ...overrides,
  };
}

function createList(initial = []) {
  const downloads = [...initial];
  const views = new Set();
  let addViewCount = 0;
  let removeViewCount = 0;
  const call = (method, ...args) => {
    for (const view of Array.from(views)) {
      view[method]?.(...args);
    }
  };
  return {
    add(candidate) {
      downloads.push(candidate);
      call("onDownloadAdded", candidate);
    },
    addView(view) {
      addViewCount += 1;
      views.add(view);
      view.onDownloadBatchStarting?.();
      for (const candidate of downloads) {
        view.onDownloadAdded?.(candidate);
      }
      view.onDownloadBatchEnded?.();
    },
    batch(callback) {
      call("onDownloadBatchStarting");
      callback();
      call("onDownloadBatchEnded");
    },
    change(candidate, overrides) {
      Object.assign(candidate, overrides);
      call("onDownloadChanged", candidate);
    },
    get addViewCount() {
      return addViewCount;
    },
    get removeViewCount() {
      return removeViewCount;
    },
    get viewCount() {
      return views.size;
    },
    remove(candidate) {
      const index = downloads.indexOf(candidate);
      if (index >= 0) {
        downloads.splice(index, 1);
      }
      call("onDownloadRemoved", candidate);
    },
    removeView(view) {
      removeViewCount += 1;
      views.delete(view);
    },
  };
}

function createDownloadsFixture({
  privateInitial = [],
  publicInitial = [],
} = {}) {
  const publicList = createList(publicInitial);
  const privateList = createList(privateInitial);
  const getListCalls = [];
  const Downloads = {
    PRIVATE: "{Downloads.PRIVATE}",
    PUBLIC: "{Downloads.PUBLIC}",
    async getList(type) {
      getListCalls.push(type);
      return type === this.PRIVATE ? privateList : publicList;
    },
  };
  return {
    Downloads,
    getListCalls,
    moduleLoader(uri) {
      assert.equal(uri, "resource://gre/modules/Downloads.sys.mjs");
      return { Downloads };
    },
    privateList,
    publicList,
  };
}

function createController({
  fixture = createDownloadsFixture(),
  privateWindow = false,
} = {}) {
  const window = createNativeWindow();
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
  const controller = createFirefoxDownloadsBridge({
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

test("normal and private windows observe only their matching native list", async () => {
  const fixture = createDownloadsFixture({
    privateInitial: [download({ currentBytes: 20, progress: 20 })],
    publicInitial: [download({ currentBytes: 40, progress: 40 })],
  });
  const normal = createController({ fixture });
  const privatePair = createController({ fixture, privateWindow: true });
  try {
    await Promise.all([
      normal.controller.ready(),
      privatePair.controller.ready(),
    ]);
    assert.deepEqual(fixture.getListCalls, [
      fixture.Downloads.PUBLIC,
      fixture.Downloads.PRIVATE,
    ]);
    assert.equal(normal.controller.downloads.snapshot().aggregatePercent, 40);
    assert.equal(
      privatePair.controller.downloads.snapshot().aggregatePercent,
      20,
    );
    assert.equal(normal.controller.snapshot().listKind, "public");
    assert.equal(privatePair.controller.snapshot().listKind, "private");
    assert.ok(
      normal.controller
        .assertRequiredCapabilities()
        .every((capability) => capability.available),
    );
  } finally {
    disposePair(normal);
    disposePair(privatePair);
  }
});

test("initial terminal history is ignored while active known progress is weighted", async () => {
  const fixture = createDownloadsFixture({
    publicInitial: [
      download({ currentBytes: 25, progress: 25, totalBytes: 100 }),
      download({ currentBytes: 100, progress: 50, totalBytes: 200 }),
      download({ progress: 100, stopped: true, succeeded: true }),
      download({ error: { becauseBlocked: true }, stopped: true }),
    ],
  });
  const pair = createController({ fixture });
  try {
    await pair.controller.ready();
    const snapshot = pair.controller.downloads.snapshot();
    assert.equal(snapshot.phase, "ready");
    assert.equal(snapshot.activeCount, 2);
    assert.equal(snapshot.aggregatePercent, 41);
    assert.equal(snapshot.progressMode, "determinate");
    assert.equal(snapshot.succeededCount, 0);
    assert.equal(snapshot.failedCount, 0);
    assert.equal(snapshot.items.length, 2);
    assert.ok(
      snapshot.items.every((item) => item.id.startsWith("download-registry-")),
    );
    assert.doesNotMatch(
      JSON.stringify(snapshot),
      /secret|private\.example|Users|Downloads\\|isPrivate|referrer/u,
    );
  } finally {
    disposePair(pair);
  }
});

test("mixed known and unknown active sizes report explicit indeterminate progress", async () => {
  const known = download({ currentBytes: 50, progress: 50 });
  const unknown = download({
    currentBytes: 12,
    hasProgress: false,
    progress: 0,
    totalBytes: 0,
  });
  const fixture = createDownloadsFixture({ publicInitial: [known, unknown] });
  const pair = createController({ fixture });
  try {
    await pair.controller.ready();
    let snapshot = pair.controller.downloads.snapshot();
    assert.equal(snapshot.progressMode, "indeterminate");
    assert.equal(snapshot.aggregatePercent, null);

    fixture.publicList.change(unknown, {
      currentBytes: 0,
      hasProgress: true,
      progress: 0,
      totalBytes: 0,
    });
    snapshot = pair.controller.downloads.snapshot();
    assert.equal(snapshot.progressMode, "determinate");
    assert.equal(snapshot.aggregatePercent, 50);
  } finally {
    disposePair(pair);
  }
});

test("paused, resumed, succeeded, failed, canceled, and queued states stay bounded", async () => {
  const fixture = createDownloadsFixture();
  const pair = createController({ fixture });
  try {
    await pair.controller.ready();
    const paused = download({
      canceled: true,
      currentBytes: 35,
      hasPartialData: true,
      progress: 35,
      stopped: true,
    });
    const queued = download({ stopped: true });
    fixture.publicList.add(paused);
    fixture.publicList.add(queued);
    let snapshot = pair.controller.downloads.snapshot();
    assert.equal(snapshot.pausedCount, 1);
    assert.equal(snapshot.queuedCount, 1);
    assert.equal(snapshot.progressMode, "none");

    fixture.publicList.change(paused, {
      canceled: false,
      hasPartialData: false,
      stopped: false,
    });
    snapshot = pair.controller.downloads.snapshot();
    assert.equal(snapshot.activeCount, 1);
    assert.equal(snapshot.pausedCount, 0);

    fixture.publicList.change(paused, {
      currentBytes: 100,
      progress: 100,
      stopped: true,
      succeeded: true,
    });
    fixture.publicList.change(queued, {
      error: { result: "fixed-error" },
      stopped: true,
    });
    const canceled = download({ canceled: true, stopped: true });
    fixture.publicList.add(canceled);
    snapshot = pair.controller.downloads.snapshot();
    assert.equal(snapshot.activeCount, 0);
    assert.equal(snapshot.succeededCount, 1);
    assert.equal(snapshot.failedCount, 1);
    assert.equal(snapshot.canceledCount, 1);
    assert.deepEqual(
      snapshot.items.map((item) => item.state),
      ["canceled", "failed", "succeeded"],
    );

    for (let index = 0; index < 10; index += 1) {
      fixture.publicList.add(
        download({ currentBytes: index, progress: index }),
      );
    }
    snapshot = pair.controller.downloads.snapshot();
    assert.equal(snapshot.items.length, maximumDownloadItems);
    assert.equal(snapshot.truncated, true);
  } finally {
    disposePair(pair);
  }
});

test("native batches publish one reconciled event and no periodic work", async () => {
  const fixture = createDownloadsFixture();
  const pair = createController({ fixture });
  try {
    await pair.controller.ready();
    const events = [];
    pair.controller.downloads.subscribe((snapshot) => events.push(snapshot));
    fixture.publicList.batch(() => {
      fixture.publicList.add(download({ currentBytes: 10, progress: 10 }));
      fixture.publicList.add(download({ currentBytes: 20, progress: 20 }));
    });
    assert.equal(events.length, 1);
    assert.equal(events[0].activeCount, 2);
    assert.equal(events[0].aggregatePercent, 15);
  } finally {
    disposePair(pair);
  }
});

test("dispose removes the exact native view and blocks later callbacks", async () => {
  const fixture = createDownloadsFixture();
  const pair = createController({ fixture });
  await pair.controller.ready();
  const events = [];
  pair.controller.downloads.subscribe((snapshot) => events.push(snapshot));
  assert.equal(fixture.publicList.viewCount, 1);
  assert.equal(pair.controller.dispose(), true);
  assert.equal(pair.controller.dispose(), false);
  assert.equal(fixture.publicList.viewCount, 0);
  assert.equal(fixture.publicList.removeViewCount, 1);
  fixture.publicList.add(download());
  assert.equal(events.length, 0);
  pair.boundary.dispose();
});

test("missing list methods and malformed native events fail with typed diagnostics", async () => {
  const fixture = createDownloadsFixture();
  fixture.Downloads.getList = async () => ({ addView() {} });
  const missing = createController({ fixture });
  await assert.rejects(missing.controller.ready(), (error) => {
    assert.equal(isFirefoxBridgeError(error), true);
    assert.equal(error.fenneviaPhase, "firefox-downloads-capability");
    assert.equal(error.fenneviaSymbol, "DownloadList.removeView");
    return true;
  });
  assert.equal(missing.errors.length, 1);
  disposePair(missing);

  const validFixture = createDownloadsFixture();
  const malformed = createController({ fixture: validFixture });
  await malformed.controller.ready();
  validFixture.publicList.add({ stopped: false });
  assert.equal(malformed.errors.length, 1);
  assert.equal(isFirefoxBridgeError(malformed.errors[0]), true);
  assert.equal(
    malformed.errors[0].fenneviaCode,
    "FENNEVIA_FIREFOX_DOWNLOAD_RECORD_INVALID",
  );
  disposePair(malformed);
});

test("module and static capability failures occur before a list view attaches", () => {
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
  assert.throws(
    () =>
      createFirefoxDownloadsBridge({
        boundary,
        moduleLoader() {
          return { Downloads: { PUBLIC: "{Downloads.PUBLIC}" } };
        },
        onError() {},
        window,
      }),
    (error) => {
      assert.equal(isFirefoxBridgeError(error), true);
      assert.equal(error.fenneviaPhase, "firefox-downloads-capability");
      assert.equal(error.fenneviaSymbol, "Downloads.getList");
      return true;
    },
  );
  boundary.dispose();
});
