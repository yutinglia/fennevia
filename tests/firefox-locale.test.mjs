import assert from "node:assert/strict";
import test from "node:test";

import {
  createFirefoxBridgeBoundary,
  isFirefoxBridgeError,
} from "../src/firefox/bridge-boundary.ts";
import {
  createFirefoxLocaleBridge,
  getShellChromeHostLabel,
} from "../src/firefox/locale.ts";

const BROWSER_URI = "chrome://browser/content/browser.xhtml";
let nextContextSequence = 0;

function createNativeWindow({
  localeTag = "en-US",
  includeLocale = true,
  includeObserver = true,
  addObserverImpl,
} = {}) {
  const observers = [];
  const window = {
    document: {
      defaultView: null,
      documentURI: BROWSER_URI,
    },
    Services: {},
  };
  if (includeLocale) {
    window.Services.locale = {
      get appLocaleAsBCP47() {
        return localeTag;
      },
      set appLocaleAsBCP47(value) {
        localeTag = value;
      },
    };
  }
  if (includeObserver) {
    window.Services.obs = {
      addObserver:
        addObserverImpl ??
        ((observer, topic) => {
          observers.push({ observer, topic });
        }),
      removeObserver(observer, topic) {
        const index = observers.findIndex(
          (record) => record.observer === observer && record.topic === topic,
        );
        if (index >= 0) {
          observers.splice(index, 1);
        }
      },
    };
  }
  window.document.defaultView = window;
  return { observers, window };
}

function createController(window, onError) {
  const errors = [];
  const boundary = createFirefoxBridgeBoundary({
    buildId: "20260810162159",
    contextId: `window-locale-${String(++nextContextSequence).padStart(2, "0")}`,
    firefoxVersion: "153.0.4",
    window,
    windowKind: "normal",
  });
  return {
    boundary,
    controller: createFirefoxLocaleBridge({
      boundary,
      onError:
        onError ??
        ((error) => {
          errors.push(error);
        }),
      window,
    }),
    errors,
  };
}

test("locale bridge maps Traditional Chinese UI locales and notifies observers", () => {
  const native = createNativeWindow({ localeTag: "zh-TW" });
  const { controller, errors } = createController(native.window);
  const capabilities = controller.assertRequiredCapabilities();
  assert.equal(
    capabilities.every((capability) => capability.requirement === "optional"),
    true,
  );
  assert.equal(
    capabilities.every((capability) => capability.available),
    true,
  );
  assert.equal(controller.locale.snapshot().id, "zh-Hant");
  assert.equal(
    getShellChromeHostLabel("zh-Hant", "frame"),
    "Fennevia 浮動瀏覽器介面",
  );

  const seen = [];
  const unsubscribe = controller.locale.subscribe((snapshot) => {
    seen.push(snapshot.id);
  });
  native.window.Services.locale.appLocaleAsBCP47 = "ja-JP";
  assert.equal(native.observers.length, 1);
  native.observers[0].observer.observe();
  assert.deepEqual(seen, ["en"]);
  assert.equal(controller.locale.snapshot().id, "en");
  assert.equal(unsubscribe(), true);
  assert.equal(controller.dispose(), true);
  assert.equal(native.observers.length, 0);
  assert.deepEqual(errors, []);
});

test("missing Services.locale falls back to English without failing health", () => {
  const native = createNativeWindow({
    includeLocale: false,
    includeObserver: false,
  });
  const { controller, errors } = createController(native.window);
  const capabilities = controller.assertRequiredCapabilities();
  assert.equal(
    capabilities.some(
      (capability) =>
        capability.name === "locale.app-locale" &&
        capability.available === false &&
        capability.requirement === "optional",
    ),
    true,
  );
  assert.equal(controller.locale.snapshot().id, "en");
  assert.equal(
    getShellChromeHostLabel("en", "top"),
    "Fennevia top controls surface",
  );
  assert.equal(controller.dispose(), true);
  assert.deepEqual(errors, []);
});

test("locale observer and subscriber failures stay optional", () => {
  const native = createNativeWindow({
    addObserverImpl() {
      throw new Error("observer-unavailable");
    },
  });
  const { controller, errors } = createController(native.window);
  assert.equal(controller.locale.snapshot().id, "en");
  assert.equal(errors.length, 1);
  assert.equal(
    isFirefoxBridgeError(errors[0]) &&
      errors[0].fenneviaCode === "FENNEVIA_FIREFOX_LOCALE_SUBSCRIBE_FAILED",
    true,
  );

  const subscriberErrors = [];
  const healthy = createNativeWindow({ localeTag: "en-US" });
  const second = createController(healthy.window, (error) => {
    subscriberErrors.push(error);
  });
  second.controller.locale.subscribe(() => {
    throw new Error("subscriber-failed");
  });
  healthy.observers[0].observer.observe();
  assert.equal(
    isFirefoxBridgeError(subscriberErrors[0]) &&
      subscriberErrors[0].fenneviaCode ===
        "FENNEVIA_FIREFOX_LOCALE_SUBSCRIBER_FAILED",
    true,
  );
  assert.throws(
    () => second.controller.locale.subscribe(/** @type {never} */ (null)),
    (error) =>
      isFirefoxBridgeError(error) &&
      error.fenneviaCode === "FENNEVIA_FIREFOX_LOCALE_LISTENER_INVALID",
  );
  assert.equal(controller.dispose(), true);
  assert.equal(second.controller.dispose(), true);
  assert.equal(second.controller.dispose(), false);
  assert.throws(
    () => second.controller.locale.snapshot(),
    (error) =>
      isFirefoxBridgeError(error) &&
      error.fenneviaCode === "FENNEVIA_FIREFOX_LOCALE_DISPOSED",
  );
});
