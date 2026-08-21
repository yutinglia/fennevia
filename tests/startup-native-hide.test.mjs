import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { shellHealthTimeoutMs } from "../profile/chrome/fennevia/content/runtime/WindowShell.sys.mjs";
import {
  registerStartupNativeHide,
  startupNativeHideTimeoutMs,
  startupNativeHideUri,
} from "../profile/chrome/fennevia/content/runtime/StartupNativeHide.sys.mjs";
import { createProcessRuntime } from "../profile/chrome/fennevia/content/runtime/Runtime.sys.mjs";

const cssPath = join(
  dirname(fileURLToPath(import.meta.url)),
  "../profile/chrome/fennevia/content/runtime/StartupNativeHide.css",
);

function createStyleSheetService() {
  const sheets = new Set();
  return {
    AUTHOR_SHEET: 2,
    USER_SHEET: 1,
    AGENT_SHEET: 0,
    loadAndRegisterSheet(uri, type) {
      sheets.add(`${uri.spec}:${type}`);
    },
    sheetRegistered(uri, type) {
      return sheets.has(`${uri.spec}:${type}`);
    },
    unregisterSheet(uri, type) {
      sheets.delete(`${uri.spec}:${type}`);
    },
    snapshot() {
      return [...sheets];
    },
  };
}

test("startup native hide constants match the health deadline and sheet URI", async () => {
  const css = await readFile(cssPath, "utf8");
  assert.equal(css.includes("\r"), false);
  assert.equal(startupNativeHideTimeoutMs, 2_000);
  assert.equal(startupNativeHideTimeoutMs, shellHealthTimeoutMs);
  assert.equal(
    startupNativeHideUri,
    "chrome://fennevia/content/runtime/StartupNativeHide.css",
  );
  assert.match(css, /animation-duration:\s*2000ms/u);
  assert.match(
    css,
    /@-moz-document url\("chrome:\/\/browser\/content\/browser\.xhtml"\)/u,
  );
  assert.match(css, /windowtype="navigator:browser"/u);
  assert.match(css, /:not\(\s*\[data-fennevia-active\]\s*\)/u);
  assert.match(css, /:not\(\s*\[data-fennevia-failed\]\s*\)/u);
  assert.match(css, /:not\(\s*\[data-fennevia-native-ui-suspended\]\s*\)/u);
  assert.match(css, /#navigator-toolbox/u);
  assert.match(css, /#PersonalToolbar/u);
  assert.match(css, /#sidebar-container/u);
  assert.match(css, /animation-timing-function:\s*step-end/u);
  assert.match(css, /100%\s*\{[\s\S]*?Restore Firefox cascade/u);
  assert.doesNotMatch(css, /#notifications-toolbar/u);
  assert.doesNotMatch(css, /display\s*:\s*none/u);
  assert.doesNotMatch(
    css,
    /#navigator-toolbox\s*\{[^}]*visibility\s*:\s*collapse/u,
  );
  assert.doesNotMatch(css, /#TabsToolbar\s*\{[^}]*visibility\s*:\s*collapse/u);
});

test("registerStartupNativeHide is a no-op without Firefox sheet services", () => {
  const registration = registerStartupNativeHide({
    styleSheetService: null,
    io: null,
  });
  assert.equal(registration.registered, false);
  assert.equal(registration.dispose(), false);
  assert.equal(registration.dispose(), false);
});

test("registerStartupNativeHide loads an author sheet and unregisters it", () => {
  const styleSheetService = createStyleSheetService();
  const io = {
    newURI(spec) {
      return { spec };
    },
  };
  const registration = registerStartupNativeHide({ styleSheetService, io });
  assert.equal(registration.registered, true);
  assert.deepEqual(styleSheetService.snapshot(), [`${startupNativeHideUri}:2`]);
  assert.equal(styleSheetService.AUTHOR_SHEET, 2);
  assert.equal(registration.dispose(), true);
  assert.deepEqual(styleSheetService.snapshot(), []);
  assert.equal(registration.dispose(), false);
});

test("registerStartupNativeHide does not duplicate an already registered sheet", () => {
  const styleSheetService = createStyleSheetService();
  const io = {
    newURI(spec) {
      return { spec };
    },
  };
  const first = registerStartupNativeHide({ styleSheetService, io });
  const second = registerStartupNativeHide({ styleSheetService, io });
  assert.equal(styleSheetService.snapshot().length, 1);
  assert.equal(second.dispose(), true);
  assert.deepEqual(styleSheetService.snapshot(), []);
  assert.equal(first.dispose(), true);
  assert.deepEqual(styleSheetService.snapshot(), []);
});

test("runtime start registers the startup hide sheet before windows and stop unregisters it", () => {
  const styleSheetService = createStyleSheetService();
  const events = [];
  const windowManager = {
    start() {
      events.push("window-start");
      assert.deepEqual(styleSheetService.snapshot(), [
        `${startupNativeHideUri}:2`,
      ]);
    },
    stop() {
      events.push("window-stop");
    },
    snapshot() {
      return { managedWindowCount: 0, initializingWindowCount: 0 };
    },
  };
  const services = {
    obs: {
      addObserver() {},
      removeObserver() {},
    },
  };
  const logger = {
    info() {},
    error() {
      assert.fail("startup hide must not fail in this test");
    },
  };
  const runtime = createProcessRuntime({
    services,
    windowManager,
    logger,
    registerStartupNativeHide: () =>
      registerStartupNativeHide({
        styleSheetService,
        io: {
          newURI(spec) {
            return { spec };
          },
        },
      }),
  });

  runtime.start();
  assert.deepEqual(events, ["window-start"]);
  assert.equal(styleSheetService.snapshot().length, 1);
  runtime.stop();
  assert.deepEqual(events, ["window-start", "window-stop"]);
  assert.deepEqual(styleSheetService.snapshot(), []);
});

test("runtime stop fails open when window cleanup throws", () => {
  const styleSheetService = createStyleSheetService();
  const errors = [];
  const runtime = createProcessRuntime({
    services: {
      obs: {
        addObserver() {},
        removeObserver() {},
      },
    },
    windowManager: {
      start() {},
      stop() {
        throw new Error("window cleanup failed");
      },
      snapshot() {
        return { managedWindowCount: 0, initializingWindowCount: 0 };
      },
    },
    logger: {
      info() {},
      error(record) {
        errors.push(record);
      },
    },
    registerStartupNativeHide: () =>
      registerStartupNativeHide({
        styleSheetService,
        io: {
          newURI(spec) {
            return { spec };
          },
        },
      }),
  });

  runtime.start();
  const stopped = runtime.stop("test-stop");

  assert.equal(stopped.state, "stopped");
  assert.deepEqual(styleSheetService.snapshot(), []);
  assert.deepEqual(
    errors.map(({ event, phase, code }) => ({ event, phase, code })),
    [
      {
        event: "runtime.window-cleanup-failed",
        phase: "test-stop",
        code: "FENNEVIA_RUNTIME_WINDOW_CLEANUP_FAILED",
      },
    ],
  );
});

test("runtime start failure unregisters the startup hide sheet", () => {
  const styleSheetService = createStyleSheetService();
  const services = {
    obs: {
      addObserver() {},
      removeObserver() {},
    },
  };
  const logger = {
    info() {},
    error() {},
  };
  const runtime = createProcessRuntime({
    services,
    windowManager: {
      start() {
        throw new Error("window start failed");
      },
      stop() {},
      snapshot() {
        return { managedWindowCount: 0, initializingWindowCount: 0 };
      },
    },
    logger,
    registerStartupNativeHide: () =>
      registerStartupNativeHide({
        styleSheetService,
        io: {
          newURI(spec) {
            return { spec };
          },
        },
      }),
  });

  assert.throws(() => runtime.start(), /window start failed/u);
  assert.deepEqual(styleSheetService.snapshot(), []);
});
