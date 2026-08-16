import assert from "node:assert/strict";
import test from "node:test";

import {
  createFirefoxBridgeBoundary,
  isFirefoxBridgeError,
} from "../src/firefox/bridge-boundary.ts";
import { createFirefoxBrowserToolsBridge } from "../src/firefox/browser-tools.ts";

const BROWSER_URI = "chrome://browser/content/browser.xhtml";
let nextContextSequence = 0;

function createEventTarget() {
  return {
    addEventListener() {},
    removeEventListener() {},
  };
}

function createNativeWindow() {
  const calls = [];
  const targets = new Map();

  function addTarget(id, { visible = true } = {}) {
    const target = {
      checkVisibility() {
        calls.push(["check-visibility", id]);
        return visible;
      },
      click() {
        calls.push(["click", id]);
      },
      focus(options) {
        calls.push(["focus", id, options]);
      },
      id,
      setVisible(nextVisible) {
        visible = nextVisible;
      },
    };
    targets.set(id, target);
    return target;
  }

  for (const id of [
    "trust-icon-container",
    "identity-icon-box",
    "tracking-protection-icon-container",
    "identity-permission-box",
    "downloads-button",
    "unified-extensions-button",
    "PanelUI-menu-button",
    "back-button",
  ]) {
    addTarget(id);
  }

  const tabContainer = createEventTarget();
  const selectedBrowser = { webNavigation: {} };
  const window = {
    PanelUI: {
      async show() {
        calls.push(["method", "PanelUI.show", this === window.PanelUI]);
      },
    },
    document: {
      defaultView: null,
      documentURI: BROWSER_URI,
      getElementById(id) {
        return targets.get(id) ?? null;
      },
    },
    gBrowser: {
      selectedBrowser,
      tabContainer,
      tabs: [],
    },
    gCustomizeMode: {
      async enter() {
        calls.push([
          "method",
          "gCustomizeMode.enter",
          this === window.gCustomizeMode,
        ]);
      },
    },
    gUnifiedExtensions: {
      async togglePanel() {
        calls.push([
          "method",
          "gUnifiedExtensions.togglePanel",
          this === window.gUnifiedExtensions,
        ]);
      },
    },
    async openPreferences() {
      calls.push(["method", "openPreferences", this === window]);
    },
  };
  window.document.defaultView = window;

  return {
    addTarget,
    calls,
    setTrustVisible(value) {
      targets.get("trust-icon-container").setVisible(value);
    },
    targets,
    window,
  };
}

function createController(native, reveal = () => true) {
  const contextId = `window-browser-tools-${String(
    ++nextContextSequence,
  ).padStart(12, "0")}`;
  const boundary = createFirefoxBridgeBoundary({
    buildId: "20260810162159",
    contextId,
    firefoxVersion: "153.0.4",
    window: native.window,
    windowKind: "normal",
  });
  const controller = createFirefoxBrowserToolsBridge({
    boundary,
    requestNativeUiReveal: reveal,
    window: native.window,
  });
  return { boundary, controller };
}

function disposePair(pair) {
  pair.controller.dispose();
  pair.boundary.dispose();
}

test("browser tools expose only fixed capabilities and native handoff booleans", () => {
  const native = createNativeWindow();
  const pair = createController(native);
  try {
    const snapshot = pair.controller.browserTools.snapshot();
    assert.deepEqual(snapshot, {
      applicationMenu: true,
      customize: true,
      downloads: true,
      extensions: true,
      nativeToolbar: true,
      protections: true,
      settings: true,
      siteInformation: true,
      sitePermissions: true,
    });
    assert.ok(Object.isFrozen(snapshot));
    const capabilities = pair.controller.assertRequiredCapabilities();
    assert.equal(capabilities.length, 12);
    assert.ok(capabilities.every((capability) => capability.available));
    assert.doesNotMatch(
      JSON.stringify(snapshot),
      /extensionId|icon|label|nativeNode|url|widget/u,
    );
  } finally {
    disposePair(pair);
  }
});

test("fixed actions focus native anchors and delegate to Firefox owners", async () => {
  const native = createNativeWindow();
  let revealCount = 0;
  const pair = createController(native, () => {
    revealCount += 1;
    return true;
  });
  try {
    for (const action of [
      "site-information",
      "protections",
      "site-permissions",
      "downloads",
      "extensions",
      "application-menu",
      "settings",
      "customize",
      "native-toolbar",
    ]) {
      assert.equal(await pair.controller.browserTools.invoke(action), true);
    }

    assert.equal(revealCount, 7);
    assert.equal(
      native.calls.filter(
        (call) => call[0] === "click" && call[1] === "trust-icon-container",
      ).length,
      2,
    );
    assert.ok(
      native.calls.some(
        (call) => call[0] === "click" && call[1] === "identity-permission-box",
      ),
    );
    assert.ok(
      native.calls.some(
        (call) => call[0] === "click" && call[1] === "downloads-button",
      ),
    );
    assert.ok(
      native.calls.some(
        (call) =>
          call[0] === "method" &&
          call[1] === "gUnifiedExtensions.togglePanel" &&
          call[2] === true,
      ),
    );
    assert.ok(
      native.calls.some(
        (call) =>
          call[0] === "method" &&
          call[1] === "PanelUI.show" &&
          call[2] === true,
      ),
    );
    assert.ok(
      native.calls.some(
        (call) =>
          call[0] === "method" &&
          call[1] === "openPreferences" &&
          call[2] === true,
      ),
    );
    assert.ok(
      native.calls.some(
        (call) =>
          call[0] === "method" &&
          call[1] === "gCustomizeMode.enter" &&
          call[2] === true,
      ),
    );
    assert.ok(
      native.calls.some(
        (call) => call[0] === "focus" && call[1] === "back-button",
      ),
    );
    assert.equal(pair.controller.snapshot().pendingActionCount, 0);
  } finally {
    disposePair(pair);
  }
});

test("identity and protections use legacy native anchors when Trust Panel is hidden", async () => {
  const native = createNativeWindow();
  native.setTrustVisible(false);
  const pair = createController(native);
  try {
    await pair.controller.browserTools.invoke("site-information");
    await pair.controller.browserTools.invoke("protections");
    assert.ok(
      native.calls.some(
        (call) => call[0] === "click" && call[1] === "identity-icon-box",
      ),
    );
    assert.ok(
      native.calls.some(
        (call) =>
          call[0] === "click" &&
          call[1] === "tracking-protection-icon-container",
      ),
    );
    assert.equal(
      native.calls.filter(
        (call) => call[0] === "click" && call[1] === "trust-icon-container",
      ).length,
      0,
    );
  } finally {
    disposePair(pair);
  }
});

test("actions re-resolve native targets at invocation time", async () => {
  const native = createNativeWindow();
  const pair = createController(native);
  try {
    const staleTarget = native.targets.get("downloads-button");
    staleTarget.click = () => {
      throw new Error("stale native target was cached");
    };
    const replacement = native.addTarget("downloads-button");
    await pair.controller.browserTools.invoke("downloads");
    assert.ok(
      native.calls.some(
        (call) => call[0] === "focus" && call[1] === replacement.id,
      ),
    );
    assert.ok(
      native.calls.some(
        (call) => call[0] === "click" && call[1] === replacement.id,
      ),
    );
  } finally {
    disposePair(pair);
  }
});

test("missing required native targets fail before activation", () => {
  const native = createNativeWindow();
  native.targets.delete("identity-permission-box");
  const boundary = createFirefoxBridgeBoundary({
    buildId: "20260810162159",
    contextId: "window-browser-tools-missing-target",
    firefoxVersion: "153.0.4",
    window: native.window,
    windowKind: "normal",
  });
  try {
    assert.throws(
      () =>
        createFirefoxBrowserToolsBridge({
          boundary,
          requestNativeUiReveal: () => true,
          window: native.window,
        }),
      (error) =>
        isFirefoxBridgeError(error) &&
        error.fenneviaCode ===
          "FENNEVIA_FIREFOX_BROWSER_TOOLS_CAPABILITY_MISSING" &&
        error.fenneviaSymbol === "document.identity-permission-box.click.focus",
    );
  } finally {
    boundary.dispose();
  }
});

test("rejected reveal and native action failures stay typed and privacy safe", async () => {
  const rejectedNative = createNativeWindow();
  const rejectedPair = createController(rejectedNative, () => false);
  try {
    await assert.rejects(
      rejectedPair.controller.browserTools.invoke("downloads"),
      (error) =>
        isFirefoxBridgeError(error) &&
        error.fenneviaCode === "FENNEVIA_FIREFOX_BROWSER_TOOLS_REVEAL_REJECTED",
    );
  } finally {
    disposePair(rejectedPair);
  }

  const failingNative = createNativeWindow();
  failingNative.targets.get("downloads-button").click = () => {
    throw new Error(
      "https://private.example.invalid C:\\Users\\person\\secret",
    );
  };
  const failingPair = createController(failingNative);
  try {
    await assert.rejects(
      failingPair.controller.browserTools.invoke("downloads"),
      (error) =>
        isFirefoxBridgeError(error) &&
        error.fenneviaCode === "FENNEVIA_FIREFOX_BROWSER_TOOLS_ACTION_FAILED" &&
        error.fenneviaSymbol === "document.downloads-button.click" &&
        !error.message.includes("private.example") &&
        !JSON.stringify(error).includes("private.example"),
    );
  } finally {
    disposePair(failingPair);
  }
});

test("browser tools disposal is idempotent and rejects later access", async () => {
  const native = createNativeWindow();
  const pair = createController(native);
  assert.equal(pair.controller.dispose(), true);
  assert.equal(pair.controller.dispose(), false);
  assert.deepEqual(pair.controller.snapshot(), {
    disposed: true,
    pendingActionCount: 0,
  });
  assert.throws(
    () => pair.controller.browserTools.snapshot(),
    /FENNEVIA_FIREFOX_BROWSER_TOOLS_DISPOSED/u,
  );
  await assert.rejects(
    pair.controller.browserTools.invoke("settings"),
    /FENNEVIA_FIREFOX_BROWSER_TOOLS_DISPOSED/u,
  );
  pair.boundary.dispose();
});
