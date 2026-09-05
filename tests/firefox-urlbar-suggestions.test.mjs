import assert from "node:assert/strict";
import test from "node:test";

import { createFirefoxBridgeBoundary } from "../src/firefox/bridge-boundary.ts";
import { createFirefoxUrlbarSuggestionsBridge } from "../src/firefox/urlbar-suggestions.ts";

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

function createResult({
  description = "",
  icon = "chrome://global/skin/icons/search-glass.svg",
  source = 3,
  title = "Firefox result",
  type = 2,
} = {}) {
  return {
    getDisplayableValueAndHighlights(name) {
      if (name === "title") {
        return { highlights: [], value: title };
      }
      if (name === "url") {
        return { highlights: [], value: "https://display.invalid/path" };
      }
      return { highlights: [], value: "" };
    },
    heuristic: false,
    icon,
    payload: { description, query: title },
    source,
    type,
  };
}

function createNativeWindow({
  missingMouseEvent = false,
  firefoxVersion = "154.0",
} = {}) {
  const tabContainer = createEventTarget();
  const selectedBrowser = { browserId: 7, webNavigation: {} };
  const calls = [];
  const pendingQueries = [];
  const view = {
    close() {
      calls.push("native-view-close");
    },
    isOpen: false,
    telemetryTypeFromElement() {
      return "enter";
    },
  };
  const manager = {
    cancelQuery(context) {
      calls.push({ cancelled: context.id });
      context.cancelled = true;
    },
    startQuery(context, controller) {
      calls.push({ started: context.id });
      const pending = { context, controller };
      pendingQueries.push(pending);
      if (!context.deferred) {
        context.results = context.nextResults ?? [];
        controller.receiveResults(context);
        return Promise.resolve();
      }
      return new Promise((resolve, reject) => {
        pending.reject = reject;
        pending.resolve = resolve;
      });
    },
  };
  const engagementEvent = {
    record() {
      calls.push("engagement-recorded");
    },
  };
  const parentController = {
    browserWindow: null,
    engagementEvent,
    manager,
    view,
  };
  const nativeController = {
    engagementEvent,
    parentController,
  };
  let nextQuerySequence = 0;
  const input = {
    controller: nativeController,
    handleRevert() {
      calls.push("reverted");
    },
    pickResult(result, event, element, browser) {
      calls.push({ browser, element, event, picked: result });
      if (result.payload.providesSearchMode) {
        this.searchMode = { engineName: "test" };
        this.startQuery({ searchString: this.value });
      }
    },
    searchMode: null,
    selectionEnd: 0,
    selectionStart: 0,
    startQuery(options) {
      const nextResults =
        Array.isArray(input.nextResultsQueue) &&
        input.nextResultsQueue.length > 0
          ? input.nextResultsQueue.shift()
          : (input.nextResults ?? []);
      const context = {
        id: ++nextQuerySequence,
        nextResults,
        results: [],
        searchString: options.searchString,
      };
      if (input.deferNextQuery) {
        context.deferred = true;
        input.deferNextQuery = false;
      }
      input.lastContext = context;
      return this.controller.startQuery(context);
    },
    value: "",
    view,
  };

  if (Number.parseInt(firefoxVersion, 10) >= 155) {
    input.pickResult = function ({
      result,
      event,
      element = null,
      browserId = null,
    }) {
      // Match Firefox 155's destructuring and native result access: the old
      // positional call must fail here rather than silently record a pick.
      calls.push({
        browserId,
        element,
        event,
        picked: result,
        providesSearchMode: result.payload.providesSearchMode,
      });
    };
  }

  class FakeKeyboardEvent {
    constructor(type, init) {
      this.type = type;
      Object.assign(this, init);
    }
  }
  class FakeMouseEvent {
    constructor(type, init) {
      this.type = type;
      Object.assign(this, init);
    }
  }

  const nativeWindow = {
    document: {
      defaultView: null,
      documentURI: BROWSER_URI,
    },
    gBrowser: {
      selectedBrowser,
      tabContainer,
      tabs: [{ linkedBrowser: selectedBrowser }],
    },
    gURLBar: input,
    KeyboardEvent: FakeKeyboardEvent,
    ...(!missingMouseEvent ? { MouseEvent: FakeMouseEvent } : {}),
  };
  nativeWindow.document.defaultView = nativeWindow;
  parentController.browserWindow = nativeWindow;

  return {
    calls,
    input,
    manager,
    nativeController,
    nativeWindow,
    pendingQueries,
    selectedBrowser,
    view,
  };
}

function createController(options = {}) {
  const fixture = createNativeWindow(options);
  const errors = [];
  const boundary = createFirefoxBridgeBoundary({
    buildId: "20260812182057",
    contextId: `window-urlbar-suggestions-${++nextContextSequence}`,
    firefoxVersion: options.firefoxVersion ?? "154.0",
    window: fixture.nativeWindow,
    windowKind: options.windowKind ?? "normal",
  });
  const controller = createFirefoxUrlbarSuggestionsBridge({
    boundary,
    onError: (error) => errors.push(error),
    window: fixture.nativeWindow,
  });
  return { boundary, controller, errors, fixture };
}

async function flushQueries() {
  await new Promise((resolve) => setImmediate(resolve));
}

const keyboardGesture = Object.freeze({
  altKey: false,
  button: 0,
  ctrlKey: false,
  kind: "keyboard",
  metaKey: false,
  shiftKey: false,
});

test("Firefox Urlbar bridge projects shared-manager results without opening native rows", async () => {
  const { boundary, controller, errors, fixture } = createController();
  const events = [];
  fixture.input.nextResults = [
    createResult({ title: "first suggestion" }),
    createResult({
      icon: "https://remote.invalid/icon.png",
      source: 1,
      title: "bookmark result",
      type: 3,
    }),
  ];
  const unsubscribe = controller.urlbarSuggestions.subscribe((event) =>
    events.push(event),
  );

  assert.equal(controller.urlbarSuggestions.query("private typed text"), true);
  assert.equal(fixture.input.controller, fixture.nativeController);
  assert.equal(fixture.view.isOpen, false);
  const snapshot = controller.urlbarSuggestions.snapshot();
  assert.equal(snapshot.phase, "results");
  assert.equal(snapshot.results.length, 2);
  assert.deepEqual(snapshot.results[0], {
    description: "https://display.invalid/path",
    execution: "direct",
    heuristic: false,
    icon: "chrome://global/skin/icons/search-glass.svg",
    source: "search",
    title: "first suggestion",
    token: snapshot.results[0].token,
    type: "search",
  });
  assert.equal(snapshot.results[1].source, "bookmarks");
  assert.equal(snapshot.results[1].icon, null);
  assert.ok(
    snapshot.results.every((result) => !result.token.includes("private")),
  );
  assert.equal(
    fixture.calls.filter((call) => call === "native-view-close").length,
    0,
  );
  assert.ok(events.length >= 2);
  assert.deepEqual(errors, []);

  await flushQueries();
  assert.equal(controller.snapshot().activeQuery, false);
  assert.equal(controller.snapshot().resultCount, 2);
  assert.equal(
    fixture.calls.filter(
      (call) => typeof call === "object" && "started" in call,
    ).length,
    1,
  );
  assert.equal(unsubscribe(), true);
  assert.equal(controller.dispose(), true);
  assert.equal(boundary.dispose(), true);
});

test("queries use Firefox's normalized native value while preserving an untrimmed editor draft", async () => {
  const { boundary, controller, errors, fixture } = createController();
  const { input } = fixture;
  let nativeValue = "";
  Object.defineProperty(input, "value", {
    configurable: true,
    get: () => nativeValue,
    set: (value) => {
      nativeValue = value.replace(/^https?:\/\//u, "");
    },
  });

  assert.equal(
    controller.urlbarSuggestions.query("https://example.invalid/path"),
    true,
  );
  assert.equal(input.value, "example.invalid/path");
  assert.equal(input.lastContext.searchString, "example.invalid/path");
  assert.equal(input.selectionStart, input.value.length);
  assert.equal(input.selectionEnd, input.value.length);
  assert.deepEqual(errors, []);

  await flushQueries();
  assert.equal(controller.dispose(), true);
  assert.equal(boundary.dispose(), true);
});

test("the first completed empty zero-prefix query retries once after Firefox lazy startup", async () => {
  const { boundary, controller, errors, fixture } = createController();
  fixture.input.nextResultsQueue = [
    [],
    [createResult({ title: "initialized top site" })],
  ];

  assert.equal(controller.urlbarSuggestions.query(""), true);
  await flushQueries();

  const snapshot = controller.urlbarSuggestions.snapshot();
  assert.equal(snapshot.phase, "results");
  assert.equal(snapshot.queryRevision, 2);
  assert.equal(snapshot.results.length, 1);
  assert.equal(snapshot.results[0].title, "initialized top site");
  assert.equal(
    fixture.calls.filter(
      (call) => typeof call === "object" && "started" in call,
    ).length,
    2,
  );
  assert.deepEqual(errors, []);

  controller.dispose();
  boundary.dispose();
});

test("a genuinely empty zero-prefix query retries only once", async () => {
  const { boundary, controller, errors, fixture } = createController();
  fixture.input.nextResultsQueue = [[], [], [createResult()]];

  assert.equal(controller.urlbarSuggestions.query(""), true);
  await flushQueries();

  assert.deepEqual(controller.urlbarSuggestions.snapshot(), {
    available: true,
    phase: "empty",
    queryRevision: 2,
    results: [],
  });
  assert.equal(
    fixture.calls.filter(
      (call) => typeof call === "object" && "started" in call,
    ).length,
    2,
  );
  assert.deepEqual(errors, []);

  controller.dispose();
  boundary.dispose();
});

test("canceling the first zero-prefix query suppresses its warm-up retry", async () => {
  const { boundary, controller, errors, fixture } = createController();
  fixture.input.deferNextQuery = true;
  fixture.input.nextResultsQueue = [[], [createResult()]];

  assert.equal(controller.urlbarSuggestions.query(""), true);
  const pending = fixture.pendingQueries[0];
  assert.equal(controller.urlbarSuggestions.cancel(), true);
  pending.context.results = [];
  pending.controller.receiveResults(pending.context);
  pending.resolve();
  await flushQueries();

  assert.equal(controller.urlbarSuggestions.snapshot().phase, "idle");
  assert.equal(
    fixture.calls.filter(
      (call) => typeof call === "object" && "started" in call,
    ).length,
    1,
  );
  assert.deepEqual(errors, []);

  controller.dispose();
  boundary.dispose();
});

test("Firefox result types and sources map to closed execution contracts", async () => {
  const { boundary, controller, fixture } = createController();
  const cases = [
    [1, 4, "tab-switch", "tabs", "direct"],
    [2, 3, "search", "search", "direct"],
    [3, 2, "url", "history", "direct"],
    [4, 1, "keyword", "bookmarks", "direct"],
    [5, 7, "omnibox", "addon", "direct"],
    [6, 5, "remote-tab", "other-local", "direct"],
    [7, 8, "tip", "actions", "native"],
    [8, 6, "dynamic", "other-network", "native"],
    [9, 99, "restrict", "unknown", "native"],
    [10, 3, "ai-chat", "search", "native"],
    [99, 99, "unknown", "unknown", "native"],
  ];
  fixture.input.nextResults = cases.map(([type, source], index) =>
    createResult({ source, title: `result ${index}`, type }),
  );

  controller.urlbarSuggestions.query("map native result contracts");
  await flushQueries();

  assert.deepEqual(
    controller.urlbarSuggestions
      .snapshot()
      .results.map((result) => [result.type, result.source, result.execution]),
    cases.map(([, , type, source, execution]) => [type, source, execution]),
  );
  controller.dispose();
  boundary.dispose();
});

test("result projection preserves order, removes duplicate objects, and bounds fields", async () => {
  const { boundary, controller, fixture } = createController();
  const duplicate = createResult({ title: "first" });
  fixture.input.nextResults = [
    duplicate,
    duplicate,
    ...Array.from({ length: 24 }, (_, index) =>
      createResult({
        description: "d".repeat(2_000),
        icon: "data:image/png;base64," + "a".repeat(3_000),
        title: `${String(index).padStart(2, "0")}-${"t".repeat(700)}`,
      }),
    ),
  ];

  controller.urlbarSuggestions.query("bounded ordered projection");
  await flushQueries();
  const results = controller.urlbarSuggestions.snapshot().results;

  assert.equal(results.length, 19);
  assert.equal(results[0].title, "first");
  assert.match(results[1].title, /^00-/u);
  assert.match(results.at(-1).title, /^17-/u);
  assert.equal(results[1].title.length, 512);
  assert.equal(results[1].description.length, 1_024);
  assert.equal(results[1].icon, null);
  controller.dispose();
  boundary.dispose();
});

test("direct result execution uses the current native result and rejects stale tokens", async () => {
  const { boundary, controller, errors, fixture } = createController();
  const nativeResult = createResult({ title: "execute me" });
  fixture.input.nextResults = [nativeResult];
  controller.urlbarSuggestions.query("bounded query");
  await flushQueries();
  const token = controller.urlbarSuggestions.snapshot().results[0].token;

  assert.deepEqual(
    controller.urlbarSuggestions.execute(token, keyboardGesture),
    { status: "committed" },
  );
  const pickCall = fixture.calls.find((call) => call?.picked === nativeResult);
  assert.equal(pickCall.browser, fixture.selectedBrowser);
  assert.equal(pickCall.element, null);
  assert.equal(pickCall.event.type, "keydown");
  assert.equal(pickCall.event.key, "Enter");
  assert.equal(fixture.input.controller, fixture.nativeController);
  assert.equal(controller.urlbarSuggestions.snapshot().phase, "idle");
  assert.deepEqual(
    controller.urlbarSuggestions.execute(token, keyboardGesture),
    { status: "rejected" },
  );
  assert.deepEqual(
    controller.urlbarSuggestions.execute("malformed_token", keyboardGesture),
    { status: "rejected" },
  );
  assert.deepEqual(errors, []);

  controller.dispose();
  boundary.dispose();
});

test("Firefox 155 picks through options and pins the current browser ID", async () => {
  for (const gesture of [
    keyboardGesture,
    { ...keyboardGesture, kind: "pointer", button: 1, ctrlKey: true },
  ]) {
    const { boundary, controller, errors, fixture } = createController({
      firefoxVersion: "155.0.1",
    });
    const result = createResult();
    fixture.input.nextResults = [result];
    controller.urlbarSuggestions.query("bounded fixture");
    await flushQueries();
    const { token } = controller.urlbarSuggestions.snapshot().results[0];
    fixture.nativeWindow.gBrowser.selectedBrowser = {
      browserId: 19,
      webNavigation: {},
    };
    assert.deepEqual(controller.urlbarSuggestions.execute(token, gesture), {
      status: "committed",
    });
    const picked = fixture.calls.find((call) => call?.picked === result);
    assert.equal(picked.browserId, 19);
    assert.equal(picked.element, null);
    assert.equal(
      picked.event.type,
      gesture.kind === "pointer" ? "click" : "keydown",
    );
    assert.equal(picked.event.ctrlKey, gesture.ctrlKey);
    assert.equal(picked.event.button, gesture.button);
    assert.equal(fixture.input.controller, fixture.nativeController);
    assert.equal(controller.snapshot().resultCount, 0);
    assert.deepEqual(controller.urlbarSuggestions.execute(token, gesture), {
      status: "rejected",
    });
    assert.deepEqual(errors, []);
    controller.dispose();
    boundary.dispose();
  }
});

test("Firefox 155 rejects invalid browser IDs before invoking native selection", async () => {
  for (const browserId of [undefined, null, "7", NaN, Infinity, 0, -1, 1.5]) {
    const { boundary, controller, errors, fixture } = createController({
      firefoxVersion: "155.0.1",
    });
    fixture.input.nextResults = [createResult()];
    controller.urlbarSuggestions.query("private fixture");
    await flushQueries();
    const { token } = controller.urlbarSuggestions.snapshot().results[0];
    fixture.selectedBrowser.browserId = browserId;
    assert.deepEqual(
      controller.urlbarSuggestions.execute(token, keyboardGesture),
      { status: "native-required" },
    );
    assert.equal(
      fixture.calls.some((call) => call?.picked),
      false,
    );
    assert.equal(fixture.input.controller, fixture.nativeController);
    assert.equal(controller.snapshot().resultCount, 0);
    assert.equal(controller.urlbarSuggestions.snapshot().phase, "failed");
    assert.equal(errors.length, 1);
    assert.doesNotMatch(JSON.stringify(errors[0]), /private fixture/u);
    controller.dispose();
    boundary.dispose();
  }
});

test("query replacement cancels exact context and ignores its late batch", async () => {
  const { boundary, controller, fixture } = createController();
  const staleResult = createResult({ title: "stale" });
  const currentResult = createResult({ title: "current" });
  fixture.input.deferNextQuery = true;
  fixture.input.nextResults = [staleResult];
  controller.urlbarSuggestions.query("first");
  const stalePending = fixture.pendingQueries[0];

  fixture.input.nextResults = [currentResult];
  controller.urlbarSuggestions.query("second");
  stalePending.context.results = [staleResult];
  stalePending.controller.receiveResults(stalePending.context);
  stalePending.resolve();
  await flushQueries();

  const snapshot = controller.urlbarSuggestions.snapshot();
  assert.equal(snapshot.results.length, 1);
  assert.equal(snapshot.results[0].title, "current");
  assert.ok(
    fixture.calls.some((call) => call?.cancelled === stalePending.context.id),
  );

  controller.dispose();
  boundary.dispose();
});

test("an empty replacement batch clears stale projections and handles", async () => {
  const { boundary, controller, fixture } = createController();
  fixture.input.nextResults = [createResult({ title: "temporary" })];
  controller.urlbarSuggestions.query("replacement batch");
  const pending = fixture.pendingQueries[0];
  const staleToken = controller.urlbarSuggestions.snapshot().results[0].token;

  pending.context.results = [];
  pending.controller.receiveResults(pending.context);
  assert.deepEqual(controller.urlbarSuggestions.snapshot(), {
    available: true,
    phase: "querying",
    queryRevision: 1,
    results: [],
  });
  assert.deepEqual(
    controller.urlbarSuggestions.execute(staleToken, keyboardGesture),
    { status: "rejected" },
  );

  await flushQueries();
  assert.equal(controller.urlbarSuggestions.snapshot().phase, "empty");
  controller.dispose();
  boundary.dispose();
});

test("a malformed native result releases its handle and fails the query open", async () => {
  const { boundary, controller, errors, fixture } = createController();
  const malformed = createResult({ title: "must not escape" });
  Object.defineProperty(malformed.payload, "text", {
    get() {
      throw new Error("private malformed payload");
    },
  });
  fixture.input.nextResults = [malformed];

  assert.equal(
    controller.urlbarSuggestions.query("private malformed query"),
    true,
  );
  await flushQueries();

  assert.equal(controller.urlbarSuggestions.snapshot().phase, "failed");
  assert.equal(controller.snapshot().resultCount, 0);
  assert.equal(errors.length, 1);
  assert.doesNotMatch(
    JSON.stringify(errors[0]),
    /private malformed payload|private malformed query|must not escape/u,
  );
  assert.equal(controller.dispose(), true);
  assert.equal(boundary.dispose(), true);
});

test("search-mode results continue through the same isolated provider manager", async () => {
  const { boundary, controller, errors, fixture } = createController();
  const result = createResult({ title: "search mode" });
  result.payload.providesSearchMode = true;
  fixture.input.nextResults = [result];
  controller.urlbarSuggestions.query("search mode query");
  await flushQueries();
  const token = controller.urlbarSuggestions.snapshot().results[0].token;

  assert.deepEqual(
    controller.urlbarSuggestions.execute(token, keyboardGesture),
    { status: "continued" },
  );
  assert.deepEqual(fixture.input.searchMode, { engineName: "test" });
  assert.equal(fixture.input.controller, fixture.nativeController);
  assert.equal(controller.urlbarSuggestions.snapshot().phase, "results");
  assert.deepEqual(errors, []);

  controller.urlbarSuggestions.cancel();
  controller.dispose();
  boundary.dispose();
});

test("Firefox 155 search-mode rows preserve the draft for native continuation", async () => {
  const { boundary, controller, errors, fixture } = createController({
    firefoxVersion: "155.0.1",
  });
  const mode = createResult();
  mode.payload.providesSearchMode = true;
  fixture.input.nextResults = [mode];
  controller.urlbarSuggestions.query("@fixture");
  await flushQueries();
  const result = controller.urlbarSuggestions.snapshot().results[0];

  assert.equal(result.execution, "native");
  assert.deepEqual(
    controller.urlbarSuggestions.execute(result.token, keyboardGesture),
    { status: "native-required" },
  );
  await flushQueries();
  assert.equal(
    fixture.calls.some((call) => call?.picked),
    false,
  );
  assert.equal(fixture.input.searchMode, null);
  assert.equal(fixture.input.controller, fixture.nativeController);
  assert.equal(controller.urlbarSuggestions.prepareNativeHandoff(), true);
  assert.equal(fixture.input.value, "@fixture");
  assert.equal(fixture.calls.includes("reverted"), false);
  assert.equal(controller.snapshot().resultCount, 0);
  assert.deepEqual(errors, []);
  controller.dispose();
  boundary.dispose();
});

test("Firefox 155 native pick errors restore ownership and clear result authority", async () => {
  const { boundary, controller, errors, fixture } = createController({
    firefoxVersion: "155.0.1",
  });
  fixture.input.nextResults = [createResult()];
  controller.urlbarSuggestions.query("private fixture");
  await flushQueries();
  const { token } = controller.urlbarSuggestions.snapshot().results[0];
  fixture.input.pickResult = () => {
    throw new Error("private execution payload");
  };
  assert.deepEqual(
    controller.urlbarSuggestions.execute(token, keyboardGesture),
    { status: "native-required" },
  );
  assert.equal(fixture.input.controller, fixture.nativeController);
  assert.equal(controller.snapshot().resultCount, 0);
  assert.equal(controller.urlbarSuggestions.snapshot().phase, "failed");
  assert.equal(
    errors[0].fenneviaCode,
    "FENNEVIA_FIREFOX_URLBAR_SUGGESTIONS_EXECUTE_FAILED",
  );
  assert.doesNotMatch(
    JSON.stringify(errors[0]),
    /private fixture|private execution payload/u,
  );
  controller.dispose();
  boundary.dispose();
});

test("normal and private windows keep result handles isolated", async () => {
  const normal = createController({ windowKind: "normal" });
  const privateWindow = createController({ windowKind: "private" });
  normal.fixture.input.nextResults = [createResult({ title: "normal result" })];
  privateWindow.fixture.input.nextResults = [
    createResult({ title: "private result" }),
  ];

  normal.controller.urlbarSuggestions.query("normal query");
  privateWindow.controller.urlbarSuggestions.query("private query");
  await flushQueries();
  const normalToken =
    normal.controller.urlbarSuggestions.snapshot().results[0].token;
  const privateToken =
    privateWindow.controller.urlbarSuggestions.snapshot().results[0].token;

  assert.notEqual(normalToken, privateToken);
  assert.doesNotMatch(normalToken, /normal|private/u);
  assert.doesNotMatch(privateToken, /normal|private/u);
  assert.deepEqual(
    normal.controller.urlbarSuggestions.execute(privateToken, keyboardGesture),
    { status: "rejected" },
  );
  assert.deepEqual(
    privateWindow.controller.urlbarSuggestions.execute(
      normalToken,
      keyboardGesture,
    ),
    { status: "rejected" },
  );
  assert.equal(normal.controller.snapshot().resultCount, 1);
  assert.equal(privateWindow.controller.snapshot().resultCount, 1);

  normal.controller.dispose();
  privateWindow.controller.dispose();
  normal.boundary.dispose();
  privateWindow.boundary.dispose();
});

test("rich native results hand off without reverting the preserved draft", async () => {
  const { boundary, controller, fixture } = createController();
  fixture.input.nextResults = [
    createResult({ source: 8, title: "native tip", type: 7 }),
  ];
  controller.urlbarSuggestions.query("preserved draft");
  await flushQueries();
  const result = controller.urlbarSuggestions.snapshot().results[0];

  assert.equal(result.execution, "native");
  assert.deepEqual(
    controller.urlbarSuggestions.execute(result.token, keyboardGesture),
    { status: "native-required" },
  );
  assert.equal(controller.urlbarSuggestions.prepareNativeHandoff(), true);
  assert.equal(fixture.input.value, "preserved draft");
  assert.equal(fixture.calls.includes("reverted"), false);
  assert.equal(controller.urlbarSuggestions.snapshot().phase, "idle");

  controller.dispose();
  boundary.dispose();
});

test("cancel reverts native input and runtime query failure stays privacy safe", async () => {
  const { boundary, controller, errors, fixture } = createController();
  fixture.input.deferNextQuery = true;
  controller.urlbarSuggestions.query("secret query must not be logged");
  const pending = fixture.pendingQueries[0];
  pending.reject(new Error("provider failed with private payload"));
  await flushQueries();

  assert.equal(controller.urlbarSuggestions.snapshot().phase, "failed");
  assert.equal(errors.length, 1);
  const serializedError = JSON.stringify(errors[0]);
  assert.doesNotMatch(serializedError, /secret query|private payload/u);
  assert.equal(
    errors[0].fenneviaCode,
    "FENNEVIA_FIREFOX_URLBAR_SUGGESTIONS_QUERY_FAILED",
  );
  assert.equal(controller.urlbarSuggestions.cancel(), true);
  assert.equal(fixture.calls.includes("reverted"), true);

  controller.dispose();
  boundary.dispose();
});

test("a synchronous native query failure still restores the exact controller", () => {
  const { boundary, controller, errors, fixture } = createController();
  fixture.input.startQuery = () => {
    throw new Error("native query failure with private text");
  };

  assert.equal(controller.urlbarSuggestions.query("must stay private"), false);
  assert.equal(fixture.input.controller, fixture.nativeController);
  assert.equal(controller.urlbarSuggestions.snapshot().phase, "failed");
  assert.equal(errors.length, 1);
  assert.doesNotMatch(
    JSON.stringify(errors[0]),
    /must stay private|private text/u,
  );

  controller.dispose();
  boundary.dispose();
});

test("missing required Urlbar capabilities fail bridge creation open", () => {
  const fixture = createNativeWindow({ missingMouseEvent: true });
  const boundary = createFirefoxBridgeBoundary({
    buildId: "20260812182057",
    contextId: `window-urlbar-suggestions-${++nextContextSequence}`,
    firefoxVersion: "154.0",
    window: fixture.nativeWindow,
    windowKind: "private",
  });

  assert.throws(
    () =>
      createFirefoxUrlbarSuggestionsBridge({
        boundary,
        onError() {},
        window: fixture.nativeWindow,
      }),
    (error) =>
      error?.fenneviaCode ===
        "FENNEVIA_FIREFOX_URLBAR_SUGGESTIONS_CAPABILITY_MISSING" &&
      error?.fenneviaSymbol === "window.MouseEvent" &&
      !JSON.stringify(error).includes("private"),
  );
  assert.equal(boundary.dispose(), true);
});

test("disposing an active result set reverts native input and clears state", async () => {
  const { boundary, controller, fixture } = createController();
  fixture.input.nextResults = [createResult({ title: "dispose me" })];
  controller.urlbarSuggestions.query("transient query");
  await flushQueries();

  assert.equal(controller.snapshot().resultCount, 1);
  assert.equal(controller.dispose(), true);
  assert.equal(controller.snapshot().disposed, true);
  assert.equal(controller.snapshot().resultCount, 0);
  assert.equal(fixture.calls.includes("reverted"), true);
  assert.equal(controller.dispose(), false);
  assert.equal(boundary.dispose(), true);
});
