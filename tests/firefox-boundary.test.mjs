import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { ESLint } from "eslint";

import {
  createFirefoxBridgeBoundary,
  createIdempotentDisposer,
  createOpaqueHandleRegistry,
  isFirefoxBridgeError,
  subscribeFirefoxEvent,
  toFirefoxBridgeDiagnostic,
} from "../src/firefox/bridge-boundary.ts";

const BROWSER_URI = "chrome://browser/content/browser.xhtml";
const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

const errorContext = Object.freeze({
  buildId: "20260810162159",
  firefoxVersion: "153.0.4",
  windowKind: "normal",
});

function createEventTarget() {
  /** @type {Array<{listener: (event: unknown) => void; options: unknown; type: string}>} */
  const listeners = [];
  return {
    /**
     * @param {string} type
     * @param {(event: unknown) => void} listener
     * @param {unknown} [options]
     */
    addEventListener(type, listener, options) {
      listeners.push({ listener, options, type });
    },
    /** @param {string} type */
    dispatch(type) {
      for (const record of listeners
        .filter((candidate) => candidate.type === type)
        .slice()) {
        record.listener({ type });
      }
    },
    listenerCount() {
      return listeners.length;
    },
    /**
     * @param {string} type
     * @param {(event: unknown) => void} listener
     * @param {unknown} [options]
     */
    removeEventListener(type, listener, options) {
      const index = listeners.findIndex(
        (candidate) =>
          candidate.type === type &&
          candidate.listener === listener &&
          candidate.options === options,
      );
      if (index !== -1) {
        listeners.splice(index, 1);
      }
    },
  };
}

/**
 * @typedef {{
 *   document: {defaultView: unknown; documentURI: string};
 *   gBrowser?: {
 *     selectedBrowser: Record<string, unknown>;
 *     tabContainer: ReturnType<typeof createEventTarget>;
 *     tabs: Array<Record<string, unknown>>;
 *   };
 *   secretTitle: string;
 *   tabContainer: ReturnType<typeof createEventTarget>;
 * }} FakeNativeWindow
 */

/** @returns {FakeNativeWindow} */
function createNativeWindow({ includeWebNavigation = true } = {}) {
  const tabContainer = createEventTarget();
  const selectedBrowser = includeWebNavigation
    ? { webNavigation: { canGoBack: false, canGoForward: false } }
    : {};
  /** @type {FakeNativeWindow} */
  const window = {
    document: {
      defaultView: null,
      documentURI: BROWSER_URI,
    },
    gBrowser: {
      selectedBrowser,
      tabContainer,
      tabs: [{ linkedBrowser: selectedBrowser }],
    },
    secretTitle: "private title that must not cross the boundary",
    tabContainer,
  };
  window.document.defaultView = window;
  return window;
}

/**
 * @param {unknown} window
 * @param {string} [contextId]
 * @param {import("../src/firefox/bridge-boundary.ts").FirefoxWindowKind} [windowKind]
 */
function createBoundary(
  window,
  contextId = "window-00000000-0000-4000-8000-000000000001",
  windowKind = "normal",
) {
  return createFirefoxBridgeBoundary({
    ...errorContext,
    contextId,
    window,
    windowKind,
  });
}

test("bridge capabilities are frozen ordinary data with explicit requirements", () => {
  const nativeWindow = createNativeWindow();
  const boundary = createBoundary(nativeWindow);
  try {
    const capabilities = boundary.assertRequiredCapabilities();
    assert.deepEqual(
      capabilities.map(({ available, name, requirement, symbol }) => ({
        available,
        name,
        requirement,
        symbol,
      })),
      [
        {
          available: true,
          name: "firefox.g-browser",
          requirement: "required",
          symbol: "window.gBrowser",
        },
        {
          available: true,
          name: "firefox.tabs",
          requirement: "required",
          symbol: "window.gBrowser.tabs",
        },
        {
          available: true,
          name: "firefox.tab-events",
          requirement: "required",
          symbol: "window.gBrowser.tabContainer",
        },
        {
          available: true,
          name: "firefox.selected-browser",
          requirement: "required",
          symbol: "window.gBrowser.selectedBrowser",
        },
        {
          available: true,
          name: "firefox.web-navigation",
          requirement: "optional",
          symbol: "window.gBrowser.selectedBrowser.webNavigation",
        },
      ],
    );
    assert.ok(Object.isFrozen(capabilities));
    assert.ok(capabilities.every(Object.isFrozen));

    const serialized = JSON.stringify({
      capabilities,
      snapshot: boundary.snapshot(),
    });
    assert.doesNotMatch(serialized, /private title|linkedBrowser/u);
    assert.equal(serialized.includes('gBrowser":'), false);
  } finally {
    boundary.dispose();
  }
});

test("an optional capability can be absent without half-initializing the context", () => {
  const boundary = createBoundary(
    createNativeWindow({
      includeWebNavigation: false,
    }),
  );
  try {
    const capabilities = boundary.assertRequiredCapabilities();
    assert.deepEqual(
      capabilities.find(
        (capability) => capability.name === "firefox.web-navigation",
      ),
      {
        available: false,
        name: "firefox.web-navigation",
        requirement: "optional",
        symbol: "window.gBrowser.selectedBrowser.webNavigation",
      },
    );
  } finally {
    boundary.dispose();
  }
});

test("missing required capabilities produce typed privacy-safe current-build errors", () => {
  const nativeWindow = createNativeWindow();
  delete nativeWindow.gBrowser;
  const boundary = createBoundary(nativeWindow);
  try {
    assert.throws(
      () => boundary.assertRequiredCapabilities(),
      (error) => {
        if (!isFirefoxBridgeError(error)) {
          return false;
        }
        assert.equal(error.message, "FENNEVIA_FIREFOX_CAPABILITY_MISSING");
        assert.deepEqual(toFirefoxBridgeDiagnostic(error), {
          buildId: "20260810162159",
          code: "FENNEVIA_FIREFOX_CAPABILITY_MISSING",
          firefoxVersion: "153.0.4",
          phase: "firefox-bridge-capability",
          symbol: "window.gBrowser",
          windowKind: "normal",
        });
        const serialized = JSON.stringify(error);
        assert.equal(serialized, "{}");
        assert.doesNotMatch(
          `${error.message}${serialized}`,
          /title|https?:|file:|[A-Za-z]:[\\/]/iu,
        );
        return true;
      },
    );
  } finally {
    boundary.dispose();
  }
});

test("subscriptions and direct disposers remove ownership exactly once", () => {
  const target = createEventTarget();
  let eventCount = 0;
  const options = Object.freeze({ capture: true });
  const unsubscribe = subscribeFirefoxEvent({
    listener() {
      eventCount += 1;
    },
    options,
    target,
    type: "TabSelect",
  });
  target.dispatch("TabSelect");
  assert.equal(eventCount, 1);
  assert.equal(unsubscribe(), true);
  assert.equal(unsubscribe(), false);
  target.dispatch("TabSelect");
  assert.equal(eventCount, 1);
  assert.equal(target.listenerCount(), 0);

  let cleanupCount = 0;
  const dispose = createIdempotentDisposer(() => {
    cleanupCount += 1;
  });
  assert.equal(dispose(), true);
  assert.equal(dispose(), false);
  assert.equal(cleanupCount, 1);
});

test("a boundary owns remaining subscriptions and disposes them in its window", () => {
  const nativeWindow = createNativeWindow();
  const boundary = createBoundary(nativeWindow);
  let eventCount = 0;
  boundary.subscribe(nativeWindow.tabContainer, "TabOpen", () => {
    eventCount += 1;
  });
  nativeWindow.tabContainer.dispatch("TabOpen");
  assert.equal(eventCount, 1);
  assert.equal(boundary.snapshot().subscriptionCount, 1);
  assert.equal(boundary.dispose(), true);
  assert.equal(boundary.dispose(), false);
  nativeWindow.tabContainer.dispatch("TabOpen");
  assert.equal(eventCount, 1);
  assert.equal(nativeWindow.tabContainer.listenerCount(), 0);
});

test("boundary disposal remains idempotent and types a native cleanup failure", () => {
  const nativeWindow = createNativeWindow();
  const boundary = createBoundary(nativeWindow);
  boundary.subscribe(
    {
      addEventListener() {},
      removeEventListener() {
        throw new Error("private native cleanup detail");
      },
    },
    "TabClose",
    () => {},
  );

  assert.throws(
    () => boundary.dispose(),
    (error) =>
      isFirefoxBridgeError(error) &&
      error.fenneviaCode === "FENNEVIA_FIREFOX_CONTEXT_DISPOSE_FAILED" &&
      error.fenneviaPhase === "firefox-context-dispose",
  );
  assert.equal(boundary.dispose(), false);
});

test("opaque IDs are stable, context-scoped, and stale-safe", () => {
  const first = createOpaqueHandleRegistry({
    context: errorContext,
    kind: "tab",
  });
  const second = createOpaqueHandleRegistry({
    context: { ...errorContext, windowKind: "private" },
    kind: "tab",
  });
  const firstHandle = { native: "first" };
  const secondHandle = { native: "second" };
  const firstId = first.register(firstHandle);
  const secondId = second.register(secondHandle);

  assert.equal(first.register(firstHandle), firstId);
  assert.strictEqual(first.resolve(firstId), firstHandle);
  assert.notEqual(firstId, secondId);
  assert.throws(
    () => second.resolve(firstId),
    (error) =>
      isFirefoxBridgeError(error) &&
      error.fenneviaCode === "FENNEVIA_FIREFOX_HANDLE_CONTEXT_MISMATCH",
  );

  assert.equal(first.release(firstId), true);
  assert.throws(
    () => first.resolve(firstId),
    (error) =>
      isFirefoxBridgeError(error) &&
      error.fenneviaCode === "FENNEVIA_FIREFOX_HANDLE_STALE",
  );
  assert.deepEqual(first.snapshot(), {
    activeHandleCount: 0,
    disposed: false,
    kind: "tab",
  });
  assert.doesNotMatch(JSON.stringify(first.snapshot()), /native|first/u);
  assert.equal(first.dispose(), true);
  assert.equal(first.dispose(), false);
  second.dispose();
});

test("one active context cannot be attached to another or duplicate window", () => {
  const firstWindow = createNativeWindow();
  const secondWindow = createNativeWindow();
  const firstId = "window-00000000-0000-4000-8000-000000000011";
  const secondId = "window-00000000-0000-4000-8000-000000000012";
  const first = createBoundary(firstWindow, firstId, "normal");
  try {
    assert.throws(
      () => createBoundary(firstWindow, secondId, "private"),
      /FENNEVIA_FIREFOX_CONTEXT_ALREADY_ACTIVE/u,
    );
    assert.throws(
      () => createBoundary(secondWindow, firstId, "normal"),
      /FENNEVIA_FIREFOX_CONTEXT_ALREADY_ACTIVE/u,
    );

    const second = createBoundary(secondWindow, secondId, "private");
    try {
      assert.notEqual(first.snapshot().contextId, second.snapshot().contextId);
      assert.notEqual(
        first.snapshot().windowKind,
        second.snapshot().windowKind,
      );
    } finally {
      second.dispose();
    }
  } finally {
    first.dispose();
  }

  const replacement = createBoundary(firstWindow, firstId, "normal");
  replacement.dispose();
});

test("a boundary validates its exact native window without exposing it", () => {
  const nativeWindow = createNativeWindow();
  const otherWindow = createNativeWindow();
  const boundary = createBoundary(nativeWindow);
  try {
    assert.equal(boundary.assertOwnsWindow(nativeWindow), true);
    assert.throws(
      () => boundary.assertOwnsWindow(otherWindow),
      (error) =>
        isFirefoxBridgeError(error) &&
        error.fenneviaCode === "FENNEVIA_FIREFOX_CONTEXT_WINDOW_MISMATCH",
    );
    assert.equal("window" in boundary.snapshot(), false);
  } finally {
    boundary.dispose();
  }
});

test("ESLint rejects Firefox imports and globals in shell and app modules", async () => {
  const eslint = new ESLint({ cwd: projectRoot });
  const [shellResult] = await eslint.lintText(
    'import { unsafe } from "../firefox/bridge-boundary";\nvoid unsafe;\nvoid gBrowser;\nvoid globalThis.gBrowser;\n',
    { filePath: path.join(projectRoot, "src", "shell", "violation.ts") },
  );
  assert.deepEqual(
    shellResult.messages.map((message) => message.ruleId).sort(),
    ["no-restricted-globals", "no-restricted-imports", "no-restricted-syntax"],
  );

  const [appResult] = await eslint.lintText("void Services;\n", {
    filePath: path.join(projectRoot, "src", "app", "violation.ts"),
  });
  assert.deepEqual(
    appResult.messages.map((message) => message.ruleId),
    ["no-restricted-globals"],
  );
});
