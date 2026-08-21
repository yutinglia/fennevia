import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { access, readFile, unlink, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import net from "node:net";
import path from "node:path";
import process from "node:process";

import {
  assertFreshSessionRestoreState,
  assertPrivacySafeSessionRestoreEvidence,
  createSessionRestoreState,
  parseSessionRestoreState,
  sessionRestoreModes,
  sessionRestorePreferenceSpecifications,
  sessionRestoreStateFileName,
} from "./session-restore-contract.mjs";

const DEFAULT_PORT = 2828;
const CONNECT_TIMEOUT_MS = 30_000;
const STATE_TIMEOUT_MS = 20_000;
const PROCESS_EXIT_TIMEOUT_MS = 20_000;
const BROWSER_TOOLBOX_TIMEOUT_MS = 45_000;
const URLBAR_COVERAGE_MATRIX_TIMEOUT_MS = 120_000;
const PERFORMANCE_IDLE_WINDOW_MS = 5_000;
const PERFORMANCE_SETTLE_WINDOW_MS = 1_000;
const PERFORMANCE_WINDOW_CYCLES = 5;
const PERFORMANCE_EDGE_SAMPLES_PER_EDGE = 3;
const SESSION_RESTORE_FIXTURES = Object.freeze([
  Object.freeze({
    id: "pinned",
    pinned: true,
    title: "Fennevia restore fixture pinned",
    url: "data:text/html;charset=utf-8,<title>Fennevia%20restore%20fixture%20pinned</title><p>pinned</p>",
  }),
  Object.freeze({
    id: "selected",
    pinned: false,
    title: "Fennevia restore fixture selected",
    url: "data:text/html;charset=utf-8,<title>Fennevia%20restore%20fixture%20selected</title><p>selected</p>",
  }),
  Object.freeze({
    id: "lazy-a",
    pinned: false,
    title: "Fennevia restore fixture lazy A",
    url: "data:text/html;charset=utf-8,<title>Fennevia%20restore%20fixture%20lazy%20A</title><p>lazy-a</p>",
  }),
  Object.freeze({
    id: "lazy-b",
    pinned: false,
    title: "Fennevia restore fixture lazy B",
    url: "data:text/html;charset=utf-8,<title>Fennevia%20restore%20fixture%20lazy%20B</title><p>lazy-b</p>",
  }),
]);
const SESSION_RESTORE_EXPECTED_ORDER = Object.freeze(
  SESSION_RESTORE_FIXTURES.map((fixture) => fixture.id),
);
const SESSION_RESTORE_EXPECTED_PENDING = Object.freeze([
  "pinned",
  "lazy-a",
  "lazy-b",
]);

function parseArguments(argv) {
  const result = {
    expectFailOpen: false,
    expectBridgeFailOpen: false,
    expectBookmarksBridgeFailOpen: false,
    expectDisabled: false,
    expectDownloadsBridgeFailOpen: false,
    expectNavigationBridgeFailOpen: false,
    expectUrlbarCoverageBridgeFailOpen: false,
    expectSafeStart: false,
    expectShellFailOpen: false,
    expectShellMissingFailOpen: false,
    expectTabsBridgeFailOpen: false,
    expectStock: false,
    inspectDom: false,
    browserToolbox: false,
    performanceBaseline: false,
    sessionRestore: null,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--firefox" || argument === "--profile") {
      const value = argv[index + 1];
      if (!value) {
        throw new Error("FENNEVIA_FIREFOX_TEST_ARGUMENT_MISSING");
      }
      result[argument.slice(2)] = value;
      index += 1;
      continue;
    }
    if (argument === "--expect-fail-open") {
      result.expectFailOpen = true;
      continue;
    }
    if (argument === "--expect-bridge-fail-open") {
      result.expectBridgeFailOpen = true;
      continue;
    }
    if (argument === "--expect-bookmarks-bridge-fail-open") {
      result.expectBookmarksBridgeFailOpen = true;
      continue;
    }
    if (argument === "--expect-disabled") {
      result.expectDisabled = true;
      continue;
    }
    if (argument === "--expect-downloads-bridge-fail-open") {
      result.expectDownloadsBridgeFailOpen = true;
      continue;
    }
    if (argument === "--expect-navigation-bridge-fail-open") {
      result.expectNavigationBridgeFailOpen = true;
      continue;
    }
    if (argument === "--expect-urlbar-coverage-bridge-fail-open") {
      result.expectUrlbarCoverageBridgeFailOpen = true;
      continue;
    }
    if (argument === "--expect-stock") {
      result.expectStock = true;
      continue;
    }
    if (argument === "--expect-safe-start") {
      result.expectSafeStart = true;
      continue;
    }
    if (argument === "--expect-shell-fail-open") {
      result.expectShellFailOpen = true;
      continue;
    }
    if (argument === "--expect-shell-missing-fail-open") {
      result.expectShellMissingFailOpen = true;
      continue;
    }
    if (argument === "--expect-tabs-bridge-fail-open") {
      result.expectTabsBridgeFailOpen = true;
      continue;
    }
    if (argument === "--inspect-dom") {
      result.inspectDom = true;
      continue;
    }
    if (argument === "--browser-toolbox") {
      result.browserToolbox = true;
      continue;
    }
    if (argument === "--performance-baseline") {
      result.performanceBaseline = true;
      continue;
    }
    if (argument === "--session-restore") {
      const value = argv[index + 1];
      if (!sessionRestoreModes.includes(value)) {
        throw new Error("FENNEVIA_FIREFOX_TEST_ARGUMENT_INVALID");
      }
      result.sessionRestore = value;
      index += 1;
      continue;
    }
    throw new Error("FENNEVIA_FIREFOX_TEST_ARGUMENT_UNKNOWN");
  }

  if (!result.firefox || !result.profile) {
    throw new Error("FENNEVIA_FIREFOX_TEST_ARGUMENT_REQUIRED");
  }
  if (
    [
      result.expectFailOpen,
      result.expectBridgeFailOpen,
      result.expectBookmarksBridgeFailOpen,
      result.expectDisabled,
      result.expectDownloadsBridgeFailOpen,
      result.expectNavigationBridgeFailOpen,
      result.expectUrlbarCoverageBridgeFailOpen,
      result.expectSafeStart,
      result.expectShellFailOpen,
      result.expectShellMissingFailOpen,
      result.expectTabsBridgeFailOpen,
      result.expectStock,
      result.inspectDom,
      result.performanceBaseline,
      result.sessionRestore !== null,
    ].filter(Boolean).length > 1
  ) {
    throw new Error("FENNEVIA_FIREFOX_TEST_MODE_CONFLICT");
  }
  if (
    result.browserToolbox &&
    (result.expectFailOpen ||
      result.expectBridgeFailOpen ||
      result.expectBookmarksBridgeFailOpen ||
      result.expectDisabled ||
      result.expectDownloadsBridgeFailOpen ||
      result.expectNavigationBridgeFailOpen ||
      result.expectUrlbarCoverageBridgeFailOpen ||
      result.expectSafeStart ||
      result.expectShellFailOpen ||
      result.expectShellMissingFailOpen ||
      result.expectTabsBridgeFailOpen ||
      result.expectStock ||
      result.inspectDom ||
      result.performanceBaseline ||
      result.sessionRestore !== null)
  ) {
    throw new Error("FENNEVIA_FIREFOX_TEST_MODE_CONFLICT");
  }
  return result;
}

async function pathExists(targetPath) {
  try {
    await access(targetPath);
    return true;
  } catch (error) {
    if (error?.code === "ENOENT") {
      return false;
    }
    throw error;
  }
}

async function readSessionRestoreState(profilePath, required) {
  const statePath = path.join(profilePath, sessionRestoreStateFileName);
  let serialized = null;
  try {
    serialized = await readFile(statePath, "utf8");
  } catch (error) {
    if (error?.code !== "ENOENT") {
      throw error;
    }
  }
  if (!required) {
    assertFreshSessionRestoreState(serialized);
    return { state: null, statePath };
  }
  if (serialized === null) {
    throw new Error("FENNEVIA_SESSION_RESTORE_STATE_MISSING");
  }
  return { state: parseSessionRestoreState(serialized), statePath };
}

async function writeSessionRestoreState(statePath, preferences) {
  const state = createSessionRestoreState(preferences);
  try {
    await writeFile(statePath, `${JSON.stringify(state)}\n`, {
      encoding: "utf8",
      flag: "wx",
    });
  } catch (error) {
    if (error?.code === "EEXIST") {
      throw new Error("FENNEVIA_SESSION_RESTORE_STATE_STALE", {
        cause: error,
      });
    }
    throw new Error("FENNEVIA_SESSION_RESTORE_STATE_WRITE_FAILED", {
      cause: error,
    });
  }
}

async function validateTarget(
  firefoxPath,
  profilePath,
  expectFailOpen,
  expectStock,
  expectDisabled,
  expectSafeStart,
  expectShellFailOpen,
  expectShellMissingFailOpen,
) {
  if (!path.isAbsolute(firefoxPath) || !path.isAbsolute(profilePath)) {
    throw new Error("FENNEVIA_FIREFOX_TEST_TARGET_NOT_ABSOLUTE");
  }
  if (path.basename(firefoxPath).toLowerCase() !== "firefox.exe") {
    throw new Error("FENNEVIA_FIREFOX_TEST_EXECUTABLE_INVALID");
  }

  await access(firefoxPath);
  const applicationPath = path.join(
    path.dirname(firefoxPath),
    "application.ini",
  );
  const applicationIni = await readFile(applicationPath, "utf8");
  if (!/^Name=Firefox$/mu.test(applicationIni)) {
    throw new Error("FENNEVIA_FIREFOX_TEST_APPLICATION_INVALID");
  }

  const programMarkerPath = path.join(
    path.dirname(firefoxPath),
    ".fennevia-program-spike.json",
  );
  const programMarker = JSON.parse(await readFile(programMarkerPath, "utf8"));
  if (
    programMarker.schemaVersion !== 1 ||
    programMarker.owner !== "fennevia" ||
    programMarker.purpose !== "firefox-identity-regression" ||
    programMarker.state !== "ready"
  ) {
    throw new Error("FENNEVIA_FIREFOX_TEST_PROGRAM_UNOWNED");
  }

  const markerPath = path.join(profilePath, ".fennevia-dev-profile.json");
  const marker = JSON.parse(await readFile(markerPath, "utf8"));
  if (
    marker.schemaVersion !== 1 ||
    marker.owner !== "fennevia" ||
    marker.profileName !== "fennevia-dev"
  ) {
    throw new Error("FENNEVIA_FIREFOX_TEST_PROFILE_UNOWNED");
  }

  const requiredArtifacts = [
    "chrome/fennevia/chrome.manifest",
    "chrome/fennevia/content/Bootstrap.sys.mjs",
    "chrome/fennevia/content/firefox/BridgeBoundary.sys.mjs",
    "chrome/fennevia/content/runtime/Logger.sys.mjs",
    "chrome/fennevia/content/runtime/Runtime.sys.mjs",
    "chrome/fennevia/content/runtime/StartupNativeHide.css",
    "chrome/fennevia/content/runtime/StartupNativeHide.sys.mjs",
    "chrome/fennevia/content/runtime/WindowShell.sys.mjs",
  ];
  if (!expectSafeStart) {
    requiredArtifacts.push(
      "chrome/fennevia/content/runtime/HealthState.sys.mjs",
    );
  }
  if (!expectFailOpen && !expectStock) {
    requiredArtifacts.push(
      "chrome/fennevia/content/runtime/WindowManager.sys.mjs",
      "chrome/fennevia/content/shell/ShellStyles.sys.mjs",
      "chrome/fennevia/content/shell/THIRD_PARTY_NOTICES.txt",
    );
    if (!expectShellMissingFailOpen) {
      requiredArtifacts.push("chrome/fennevia/content/shell/ShellApp.js");
    }
  }
  if (!expectStock) {
    for (const relativePath of requiredArtifacts) {
      await access(path.join(profilePath, ...relativePath.split("/")));
    }
  } else {
    for (const removedPath of [
      path.join(path.dirname(firefoxPath), "defaults", "pref", "fennevia.js"),
      path.join(path.dirname(firefoxPath), "fennevia.cfg"),
      path.join(path.dirname(firefoxPath), ".fennevia"),
      path.join(profilePath, "chrome", "fennevia"),
      path.join(profilePath, ".fennevia"),
    ]) {
      if (await pathExists(removedPath)) {
        throw new Error("FENNEVIA_FIREFOX_TEST_STOCK_RESIDUE");
      }
    }
  }

  if (expectDisabled) {
    const activePreference = path.join(
      path.dirname(firefoxPath),
      "defaults",
      "pref",
      "fennevia.js",
    );
    const disabledPreference = `${activePreference}.disabled`;
    if (
      (await pathExists(activePreference)) ||
      !(await pathExists(disabledPreference))
    ) {
      throw new Error("FENNEVIA_FIREFOX_TEST_DISABLE_STATE_INVALID");
    }
  }
}

async function assertPortAvailable(port) {
  const server = net.createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", resolve);
  });
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

class MarionetteClient {
  constructor(socket) {
    this.socket = socket;
    this.buffer = Buffer.alloc(0);
    this.frames = [];
    this.waiters = [];
    this.nextCommandId = 0;
    this.closed = false;

    socket.on("data", (chunk) => this.onData(chunk));
    socket.on("close", () => this.onClose());
    socket.on("error", (error) => this.onClose(error));
  }

  static async connect(port) {
    const socket = net.createConnection({ host: "127.0.0.1", port });
    await new Promise((resolve, reject) => {
      socket.once("connect", resolve);
      socket.once("error", reject);
    });
    const client = new MarionetteClient(socket);
    const hello = await client.nextFrame(5_000);
    if (
      hello?.applicationType !== "gecko" ||
      !Number.isInteger(hello.marionetteProtocol) ||
      hello.marionetteProtocol < 3
    ) {
      client.close();
      throw new Error("FENNEVIA_FIREFOX_TEST_MARIONETTE_PROTOCOL_INVALID");
    }
    return client;
  }

  onData(chunk) {
    this.buffer = Buffer.concat([this.buffer, chunk]);
    while (this.buffer.length > 0) {
      const colonIndex = this.buffer.indexOf(58);
      if (colonIndex === -1) {
        return;
      }
      const lengthText = this.buffer.subarray(0, colonIndex).toString("ascii");
      if (!/^\d+$/u.test(lengthText)) {
        this.onClose(
          new Error("FENNEVIA_FIREFOX_TEST_MARIONETTE_FRAME_INVALID"),
        );
        return;
      }
      const bodyLength = Number(lengthText);
      const bodyStart = colonIndex + 1;
      if (this.buffer.length < bodyStart + bodyLength) {
        return;
      }
      const body = this.buffer
        .subarray(bodyStart, bodyStart + bodyLength)
        .toString("utf8");
      this.buffer = this.buffer.subarray(bodyStart + bodyLength);
      let frame;
      try {
        frame = JSON.parse(body);
      } catch {
        this.onClose(
          new Error("FENNEVIA_FIREFOX_TEST_MARIONETTE_JSON_INVALID"),
        );
        return;
      }
      this.deliver(frame);
    }
  }

  deliver(frame) {
    const waiter = this.waiters.shift();
    if (waiter) {
      clearTimeout(waiter.timeout);
      waiter.resolve(frame);
    } else {
      this.frames.push(frame);
    }
  }

  onClose(error = new Error("FENNEVIA_FIREFOX_TEST_MARIONETTE_CLOSED")) {
    if (this.closed) {
      return;
    }
    this.closed = true;
    for (const waiter of this.waiters.splice(0)) {
      clearTimeout(waiter.timeout);
      waiter.reject(error);
    }
  }

  nextFrame(timeoutMs) {
    if (this.frames.length > 0) {
      return Promise.resolve(this.frames.shift());
    }
    if (this.closed) {
      return Promise.reject(
        new Error("FENNEVIA_FIREFOX_TEST_MARIONETTE_CLOSED"),
      );
    }
    return new Promise((resolve, reject) => {
      const waiter = { reject, resolve, timeout: null };
      waiter.timeout = setTimeout(() => {
        const index = this.waiters.indexOf(waiter);
        if (index !== -1) {
          this.waiters.splice(index, 1);
        }
        reject(new Error("FENNEVIA_FIREFOX_TEST_MARIONETTE_TIMEOUT"));
      }, timeoutMs);
      this.waiters.push(waiter);
    });
  }

  send(frame) {
    const body = Buffer.from(JSON.stringify(frame), "utf8");
    this.socket.write(Buffer.concat([Buffer.from(`${body.length}:`), body]));
  }

  async request(name, parameters = {}, timeoutMs = STATE_TIMEOUT_MS) {
    this.nextCommandId += 1;
    const commandId = this.nextCommandId;
    this.send([0, commandId, name, parameters]);

    while (true) {
      const response = await this.nextFrame(timeoutMs);
      if (
        Array.isArray(response) &&
        response[0] === 1 &&
        response[1] === commandId
      ) {
        if (response[2]) {
          const remoteMessage = String(response[2].message ?? "");
          const projectCode = remoteMessage.match(
            /\bFENNEVIA_[A-Z0-9_]{1,120}\b/u,
          )?.[0];
          if (projectCode) {
            throw new Error(projectCode);
          }
          const remoteCode = String(response[2].error ?? "unknown error")
            .replace(/[^A-Za-z0-9_-]/gu, "_")
            .toUpperCase()
            .slice(0, 80);
          const commandCode = name.replace(/[^A-Za-z0-9]/gu, "_").toUpperCase();
          throw new Error(
            `FENNEVIA_FIREFOX_TEST_REMOTE_${remoteCode}_${commandCode}`,
          );
        }
        return response[3];
      }
      if (Array.isArray(response) && response[0] === 0) {
        this.send([
          1,
          response[1],
          {
            error: "unknown command",
            message: "Unsupported server command",
            stacktrace: "",
          },
          null,
        ]);
      }
    }
  }

  execute(script, timeoutMs = STATE_TIMEOUT_MS) {
    return this.request(
      "WebDriver:ExecuteScript",
      {
        args: [],
        filename: "fennevia-window-lifecycle.mjs",
        line: 1,
        newSandbox: true,
        sandbox: "system",
        script: script.trim(),
      },
      timeoutMs,
    ).then((result) => result?.value);
  }

  close() {
    if (!this.closed) {
      this.closed = true;
      this.socket.destroy();
    }
  }
}

async function connectWithRetry(port, child) {
  const deadline = Date.now() + CONNECT_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error("FENNEVIA_FIREFOX_TEST_PROCESS_EARLY_EXIT");
    }
    try {
      return await MarionetteClient.connect(port);
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
  throw new Error("FENNEVIA_FIREFOX_TEST_CONNECT_TIMEOUT");
}

async function waitForState(client, predicate, code) {
  const deadline = Date.now() + STATE_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const state = await client.execute(`
      const { startProcessRuntime } = ChromeUtils.importESModule(
        "chrome://fennevia/content/runtime/Runtime.sys.mjs"
      );
      const publicState = startProcessRuntime({
        createWindowManager() {
          throw new Error("FENNEVIA_RUNTIME_STATE_MISSING");
        },
      });
      return publicState.runtime.snapshot();
    `);
    if (predicate(state)) {
      return state;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(code);
}

async function collectEvidence(client) {
  return client.execute(`
    const records = [];
    let firstPartyScriptErrorCount = 0;
    for (const message of Services.console.getMessageArray() ?? []) {
      const text = String(message?.message ?? message ?? "");
      for (const prefix of ["[Fennevia bootstrap] ", "[Fennevia runtime] "]) {
        if (text.startsWith(prefix)) {
          try {
            records.push(JSON.parse(text.slice(prefix.length)));
          } catch {
            firstPartyScriptErrorCount += 1;
          }
        }
      }
      const sourceName = String(message?.sourceName ?? "");
      if (
        sourceName.includes("chrome://fennevia/") &&
        !text.startsWith("[Fennevia ")
      ) {
        firstPartyScriptErrorCount += 1;
      }
    }
    return { firstPartyScriptErrorCount, records };
  `);
}

async function collectSessionRestorePreferenceSnapshot(client) {
  return client.execute(`
    const specifications = ${JSON.stringify(
      sessionRestorePreferenceSpecifications,
    )};
    return specifications.map(specification => ({
      hadUserValue: Services.prefs.prefHasUserValue(specification.name),
      name: specification.name,
      type: specification.type,
      value: specification.type === "integer"
        ? Services.prefs.getIntPref(specification.name, 1)
        : Services.prefs.getBoolPref(specification.name, false),
    }));
  `);
}

async function waitForSessionStoreStartup(client) {
  assert.equal(
    await client.execute(`
      const { SessionStore } = ChromeUtils.importESModule(
        "resource:///modules/sessionstore/SessionStore.sys.mjs"
      );
      return SessionStore.promiseAllWindowsRestored.then(() => true);
    `),
    true,
  );
}

async function prepareSessionRestoreFixture(client) {
  assert.equal(
    await client.execute(
      `
      return (async () => {
        const { SessionStore } = ChromeUtils.importESModule(
          "resource:///modules/sessionstore/SessionStore.sys.mjs"
        );
        const { TabStateFlusher } = ChromeUtils.importESModule(
          "resource:///modules/sessionstore/TabStateFlusher.sys.mjs"
        );
        const fixtures = ${JSON.stringify(SESSION_RESTORE_FIXTURES)};
        const preferenceValues = new Map([
          ["browser.startup.page", 3],
          ["browser.sessionstore.newTabOnRestore", false],
          ["browser.sessionstore.newTabOnRestore.showSetting", false],
          ["browser.sessionstore.restore_on_demand", true],
          ["browser.sessionstore.restore_pinned_tabs_on_demand", true],
          ["browser.sessionstore.restore_tabs_lazily", true],
          ["browser.sessionstore.resume_session_once", false],
        ]);
        for (const [name, value] of preferenceValues) {
          if (typeof value === "boolean") {
            Services.prefs.setBoolPref(name, value);
          } else {
            Services.prefs.setIntPref(name, value);
          }
        }

        const topic = "sessionstore-browser-state-restored";
        const restored = new Promise((resolve, reject) => {
          const timer = window.setTimeout(() => {
            Services.obs.removeObserver(observer, topic);
            reject(new Error("FENNEVIA_SESSION_RESTORE_PREPARE_TIMEOUT"));
          }, 20000);
          const observer = {
            observe() {
              window.clearTimeout(timer);
              Services.obs.removeObserver(observer, topic);
              resolve();
            },
          };
          Services.obs.addObserver(observer, topic);
        });
        SessionStore.setBrowserState(JSON.stringify({
          selectedWindow: 1,
          windows: [{
            selected: 2,
            tabs: fixtures.map(fixture => ({
              entries: [{ title: fixture.title, url: fixture.url }],
              index: 1,
              pinned: fixture.pinned,
            })),
          }],
        }));
        await restored;
        await TabStateFlusher.flushWindow(window);
        return true;
      })();
    `,
      STATE_TIMEOUT_MS,
    ),
    true,
  );
}

async function collectSessionRestoreFixtureState(client) {
  return client.execute(`
    const { SessionStore } = ChromeUtils.importESModule(
      "resource:///modules/sessionstore/SessionStore.sys.mjs"
    );
    const fixtures = ${JSON.stringify(SESSION_RESTORE_FIXTURES)};
    const idByUrl = new Map(fixtures.map(fixture => [fixture.url, fixture.id]));
    const idByTitle = new Map(
      fixtures.map(fixture => [fixture.title, fixture.id])
    );
    const fixtureIdForTab = tab => {
      const state = JSON.parse(SessionStore.getTabState(tab));
      const activeIndex = Math.max(
        0,
        Math.min((state.index || state.entries.length) - 1, state.entries.length - 1)
      );
      return idByUrl.get(state.entries[activeIndex]?.url) ?? "unexpected";
    };
    const nativeTabs = [...gBrowser.openTabs];
    const nativeOrder = nativeTabs.map(fixtureIdForTab);
    const frontendItems = [
      ...document.querySelectorAll(".fennevia-tab-strip__item"),
    ];
    const frontendOrder = frontendItems.map(item =>
      idByTitle.get(
        item.querySelector('[data-fennevia-tab]')?.getAttribute("title")
      ) ?? "unexpected"
    );
    return {
      frontendOrder,
      frontendPinnedIds: frontendItems
        .filter(item => item.getAttribute("data-fennevia-pinned") === "true")
        .map(item =>
          idByTitle.get(
            item.querySelector('[data-fennevia-tab]')?.getAttribute("title")
          ) ?? "unexpected"
        ),
      frontendSelectedId:
        frontendItems
          .filter(item => item.getAttribute("data-fennevia-selected") === "true")
          .map(item =>
            idByTitle.get(
              item.querySelector('[data-fennevia-tab]')?.getAttribute("title")
            ) ?? "unexpected"
          )[0] ?? null,
      nativeOrder,
      pendingIds: nativeTabs
        .filter(tab => tab.hasAttribute("pending"))
        .map(fixtureIdForTab),
      pinnedIds: nativeTabs
        .filter(tab => tab.hasAttribute("pinned"))
        .map(fixtureIdForTab),
      selectedId: fixtureIdForTab(gBrowser.selectedTab),
    };
  `);
}

async function waitForSessionRestoreFixture(client, frontendExpected) {
  const deadline = Date.now() + STATE_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const state = await collectSessionRestoreFixtureState(client);
    const nativeReady =
      JSON.stringify(state.nativeOrder) ===
        JSON.stringify(SESSION_RESTORE_EXPECTED_ORDER) &&
      JSON.stringify(state.pinnedIds) === JSON.stringify(["pinned"]) &&
      state.selectedId === "selected";
    const frontendReady = frontendExpected
      ? JSON.stringify(state.frontendOrder) ===
          JSON.stringify(SESSION_RESTORE_EXPECTED_ORDER) &&
        JSON.stringify(state.frontendPinnedIds) ===
          JSON.stringify(["pinned"]) &&
        state.frontendSelectedId === "selected"
      : state.frontendOrder.length === 0 &&
        state.frontendPinnedIds.length === 0 &&
        state.frontendSelectedId === null;
    if (nativeReady && frontendReady) {
      return state;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("FENNEVIA_SESSION_RESTORE_FIXTURE_TIMEOUT");
}

async function exerciseSessionRestoreNativeReveal(client) {
  return client.execute(`
    return (async () => {
      const root = document.documentElement;
      const toolbox = document.getElementById("navigator-toolbox");
      const navBar = document.getElementById("nav-bar");
      if (!toolbox || !navBar || !gBrowser.selectedBrowser) {
        throw new Error("FENNEVIA_SESSION_RESTORE_NATIVE_REVEAL_MISSING");
      }
      const waitFor = async (predicate, code) => {
        const deadline = Date.now() + 5000;
        while (Date.now() < deadline) {
          if (predicate()) {
            return;
          }
          await new Promise(resolve => window.setTimeout(resolve, 20));
        }
        throw new Error(code);
      };
      gBrowser.selectedBrowser.focus();
      await waitFor(
        () => !root.hasAttribute("data-fennevia-native-ui-revealed"),
        "FENNEVIA_SESSION_RESTORE_NATIVE_REVEAL_BASELINE_TIMEOUT"
      );
      toolbox.dispatchEvent(new PointerEvent("pointerenter"));
      await waitFor(
        () =>
          root.hasAttribute("data-fennevia-native-ui-revealed") &&
          getComputedStyle(navBar).visibility !== "collapse",
        "FENNEVIA_SESSION_RESTORE_NATIVE_REVEAL_TIMEOUT"
      );
      const revealObserved = true;
      toolbox.dispatchEvent(new PointerEvent("pointerleave"));
      gBrowser.selectedBrowser.focus();
      await waitFor(
        () =>
          !root.hasAttribute("data-fennevia-native-ui-revealed") &&
          getComputedStyle(navBar).visibility === "collapse",
        "FENNEVIA_SESSION_RESTORE_NATIVE_RELEASE_TIMEOUT"
      );
      return { revealObserved, revealReleased: true };
    })();
  `);
}

async function exerciseFailOpenRestoredTab(client) {
  return client.execute(`
    return (async () => {
      const { SessionStore } = ChromeUtils.importESModule(
        "resource:///modules/sessionstore/SessionStore.sys.mjs"
      );
      const fixtures = ${JSON.stringify(SESSION_RESTORE_FIXTURES)};
      const idByUrl = new Map(fixtures.map(fixture => [fixture.url, fixture.id]));
      const fixtureIdForTab = tab => {
        const state = JSON.parse(SessionStore.getTabState(tab));
        const index = Math.max(
          0,
          Math.min((state.index || state.entries.length) - 1, state.entries.length - 1)
        );
        return idByUrl.get(state.entries[index]?.url) ?? "unexpected";
      };
      const original = gBrowser.selectedTab;
      const pending = gBrowser.openTabs.find(
        tab => fixtureIdForTab(tab) === "lazy-a" && tab.hasAttribute("pending")
      );
      if (!pending) {
        throw new Error("FENNEVIA_SESSION_RESTORE_PENDING_TAB_MISSING");
      }
      gBrowser.selectedTab = pending;
      const deadline = Date.now() + 10000;
      while (Date.now() < deadline && pending.hasAttribute("pending")) {
        await new Promise(resolve => window.setTimeout(resolve, 20));
      }
      const pendingActivated =
        gBrowser.selectedTab === pending && !pending.hasAttribute("pending");
      gBrowser.selectedTab = original;
      return {
        pendingActivated,
        selectionRestored: gBrowser.selectedTab === original,
      };
    })();
  `);
}

async function cleanupSessionRestoreFixture(client, state) {
  return client.execute(
    `
    return (async () => {
      const { SessionStore } = ChromeUtils.importESModule(
        "resource:///modules/sessionstore/SessionStore.sys.mjs"
      );
      const { TabStateFlusher } = ChromeUtils.importESModule(
        "resource:///modules/sessionstore/TabStateFlusher.sys.mjs"
      );
      const savedPreferences = ${JSON.stringify(state.preferences)};
      const topic = "sessionstore-browser-state-restored";
      const restored = new Promise((resolve, reject) => {
        const timer = window.setTimeout(() => {
          Services.obs.removeObserver(observer, topic);
          reject(new Error("FENNEVIA_SESSION_RESTORE_CLEANUP_TIMEOUT"));
        }, 20000);
        const observer = {
          observe() {
            window.clearTimeout(timer);
            Services.obs.removeObserver(observer, topic);
            resolve();
          },
        };
        Services.obs.addObserver(observer, topic);
      });
      SessionStore.setBrowserState(JSON.stringify({
        selectedWindow: 1,
        windows: [{
          selected: 1,
          tabs: [{ entries: [{ url: "about:blank" }], index: 1 }],
        }],
      }));
      await restored;
      await TabStateFlusher.flushWindow(window);

      for (const preference of savedPreferences) {
        if (!preference.hadUserValue) {
          if (Services.prefs.prefHasUserValue(preference.name)) {
            Services.prefs.clearUserPref(preference.name);
          }
        } else if (preference.type === "integer") {
          Services.prefs.setIntPref(preference.name, preference.value);
        } else {
          Services.prefs.setBoolPref(preference.name, preference.value);
        }
      }
      const preferencesRestored = savedPreferences.every(preference => {
        if (
          Services.prefs.prefHasUserValue(preference.name) !==
          preference.hadUserValue
        ) {
          return false;
        }
        if (!preference.hadUserValue) {
          return true;
        }
        return preference.type === "integer"
          ? Services.prefs.getIntPref(preference.name) === preference.value
          : Services.prefs.getBoolPref(preference.name) === preference.value;
      });
      const baseline =
        gBrowser.openTabs.length === 1 &&
        gBrowser.selectedTab === gBrowser.openTabs[0] &&
        JSON.parse(SessionStore.getTabState(gBrowser.openTabs[0])).entries[0]
          ?.url === "about:blank";
      return { baseline, preferencesRestored };
    })();
  `,
    STATE_TIMEOUT_MS,
  );
}

async function executeSessionRestoreMode(client, mode, stateContext) {
  await waitForSessionStoreStartup(client);

  if (mode === "fail-open") {
    await new Promise((resolve) => setTimeout(resolve, 750));
    assert.deepEqual(await collectNativeState(client), EXPECTED_NATIVE_STATE);
    await assertNoShellHosts(client);
    const fixture = await waitForSessionRestoreFixture(client, false);
    assert.deepEqual(fixture.pendingIds, SESSION_RESTORE_EXPECTED_PENDING);
    const runtimeState = await client.execute(`
      const { startProcessRuntime } = ChromeUtils.importESModule(
        "chrome://fennevia/content/runtime/Runtime.sys.mjs"
      );
      return startProcessRuntime({
        createWindowManager() {
          throw new Error("FENNEVIA_RUNTIME_STATE_MISSING");
        },
      }).runtime.snapshot();
    `);
    assert.deepEqual(runtimeState, {
      initializationCount: 1,
      initializingWindowCount: 0,
      managedWindowCount: 0,
      state: "started",
    });
    const nativeInteraction = await exerciseFailOpenRestoredTab(client);
    assert.deepEqual(nativeInteraction, {
      pendingActivated: true,
      selectionRestored: true,
    });
    const records = await collectEvidence(client);
    const shellFailures = records.records.filter(
      (record) => record.event === "shell.lifecycle-failed",
    );
    assert.equal(countEvent(records, "bootstrap.success"), 1);
    assert.equal(countEvent(records, "runtime.started"), 1);
    assert.equal(countEvent(records, "window.initialized"), 0);
    assert.equal(countEvent(records, "window.initialization-failed"), 1);
    assert.equal(shellFailures.length, 1);
    assert.equal(shellFailures[0].code, "FENNEVIA_FRONTEND_SCRIPT_LOAD_FAILED");
    assert.equal(shellFailures[0].phase, "shell-frontend-load");
    assert.equal(records.firstPartyScriptErrorCount, 0);
    return assertPrivacySafeSessionRestoreEvidence({
      active: false,
      firstPartyScriptErrorCount: records.firstPartyScriptErrorCount,
      fixtureCount: fixture.nativeOrder.length,
      frontendOrder: fixture.frontendOrder,
      hostCount: 0,
      managedWindowCount: runtimeState.managedWindowCount,
      nativeOrder: fixture.nativeOrder,
      pendingActivated: nativeInteraction.pendingActivated,
      pendingIds: fixture.pendingIds,
      phase: "fail-open",
      pinnedIds: fixture.pinnedIds,
      runtimeStartCount: countEvent(records, "runtime.started"),
      schemaVersion: 1,
      selectedId: fixture.selectedId,
      selectionRestored: nativeInteraction.selectionRestored,
      shellFailureCount: shellFailures.length,
      windowInitializedCount: countEvent(records, "window.initialized"),
    });
  }

  const runtimeState = await waitForState(
    client,
    (state) =>
      state?.state === "started" &&
      state.initializationCount === 1 &&
      state.managedWindowCount === 1,
    "FENNEVIA_SESSION_RESTORE_RUNTIME_TIMEOUT",
  );
  assert.equal(runtimeState.initializingWindowCount, 0);
  assert.deepEqual(
    await collectNativeState(client),
    EXPECTED_ACTIVE_NATIVE_STATE,
  );
  assertShellHostState(await collectShellHostState(client), "normal");
  assertFrontendState(await collectFrontendState(client), "normal");

  if (mode === "cleanup") {
    const cleanup = await cleanupSessionRestoreFixture(
      client,
      stateContext.state,
    );
    assert.deepEqual(cleanup, {
      baseline: true,
      preferencesRestored: true,
    });
    await waitForFrontendTabCount(client, 1);
    const records = await collectEvidence(client);
    assert.equal(
      records.records.filter((record) => record.level === "error").length,
      0,
    );
    assert.equal(records.firstPartyScriptErrorCount, 0);
    return {
      active: true,
      firstPartyScriptErrorCount: records.firstPartyScriptErrorCount,
      fixtureCount: 0,
      hostCount: 6,
      managedWindowCount: runtimeState.managedWindowCount,
      phase: "clean",
      preferencesRestored: cleanup.preferencesRestored,
      runtimeStartCount: countEvent(records, "runtime.started"),
      schemaVersion: 1,
      windowInitializedCount: countEvent(records, "window.initialized"),
    };
  }

  if (mode === "prepare") {
    const preferences = await collectSessionRestorePreferenceSnapshot(client);
    await writeSessionRestoreState(stateContext.statePath, preferences);
    await prepareSessionRestoreFixture(client);
  }

  const fixture = await waitForSessionRestoreFixture(client, true);
  assert.deepEqual(fixture.nativeOrder, SESSION_RESTORE_EXPECTED_ORDER);
  assert.deepEqual(fixture.frontendOrder, SESSION_RESTORE_EXPECTED_ORDER);
  assert.deepEqual(fixture.pinnedIds, ["pinned"]);
  assert.deepEqual(fixture.frontendPinnedIds, ["pinned"]);
  assert.equal(fixture.selectedId, "selected");
  assert.equal(fixture.frontendSelectedId, "selected");
  if (mode === "verify") {
    assert.deepEqual(fixture.pendingIds, SESSION_RESTORE_EXPECTED_PENDING);
  }

  const records = await collectEvidence(client);
  assert.equal(countEvent(records, "bootstrap.success"), 1);
  assert.equal(countEvent(records, "runtime.started"), 1);
  assert.equal(countEvent(records, "window.initialized", "normal"), 1);
  assert.equal(
    records.records.filter((record) => record.level === "error").length,
    0,
  );
  assert.equal(records.firstPartyScriptErrorCount, 0);

  if (mode === "prepare") {
    return assertPrivacySafeSessionRestoreEvidence({
      active: true,
      firstPartyScriptErrorCount: records.firstPartyScriptErrorCount,
      fixtureCount: fixture.nativeOrder.length,
      frontendOrder: fixture.frontendOrder,
      hostCount: 6,
      managedWindowCount: runtimeState.managedWindowCount,
      nativeOrder: fixture.nativeOrder,
      phase: "prepared",
      pinnedIds: fixture.pinnedIds,
      runtimeStartCount: countEvent(records, "runtime.started"),
      schemaVersion: 1,
      selectedId: fixture.selectedId,
      windowInitializedCount: countEvent(
        records,
        "window.initialized",
        "normal",
      ),
    });
  }

  const reveal = await exerciseSessionRestoreNativeReveal(client);
  assert.deepEqual(reveal, {
    revealObserved: true,
    revealReleased: true,
  });
  return assertPrivacySafeSessionRestoreEvidence({
    active: true,
    firstPartyScriptErrorCount: records.firstPartyScriptErrorCount,
    fixtureCount: fixture.nativeOrder.length,
    frontendOrder: fixture.frontendOrder,
    hostCount: 6,
    managedWindowCount: runtimeState.managedWindowCount,
    nativeOrder: fixture.nativeOrder,
    pendingIds: fixture.pendingIds,
    phase: "restored",
    pinnedIds: fixture.pinnedIds,
    revealObserved: reveal.revealObserved,
    revealReleased: reveal.revealReleased,
    runtimeStartCount: countEvent(records, "runtime.started"),
    schemaVersion: 1,
    selectedId: fixture.selectedId,
    windowInitializedCount: countEvent(records, "window.initialized", "normal"),
  });
}

async function collectProcessResourceSnapshot(client) {
  return client.execute(`
    return ChromeUtils.requestProcInfo().then(parent => {
      const processes = [parent, ...(parent.children ?? [])];
      const numeric = value => {
        const result = Number(value);
        return Number.isFinite(result) && result >= 0 ? result : 0;
      };
      return {
        cpuCycleCount: Math.round(
          processes.reduce(
            (total, processInfo) => total + numeric(processInfo.cpuCycleCount),
            0
          )
        ),
        cpuTimeNs: Math.round(
          processes.reduce(
            (total, processInfo) => total + numeric(processInfo.cpuTime),
            0
          )
        ),
        memoryBytes: Math.round(
          processes.reduce(
            (total, processInfo) => total + numeric(processInfo.memory),
            0
          )
        ),
        processCount: processes.length,
      };
    });
  `);
}

async function measureEdgeRevealLatency(client) {
  return client.execute(`
    return (async () => {
      const edges = ["top", "left", "right", "bottom"];
      const samplesPerEdge = ${PERFORMANCE_EDGE_SAMPLES_PER_EDGE};
      const frame = document.getElementById("fennevia-shell-frame-host");
      if (!frame) {
        throw new Error("FENNEVIA_FIREFOX_TEST_EDGE_SHELL_MISSING");
      }
      const sleep = delay => new Promise(
        resolve => window.setTimeout(resolve, delay)
      );
      const waitFor = async (predicate, code) => {
        const deadline = performance.now() + 3000;
        while (performance.now() < deadline) {
          if (predicate()) {
            return performance.now();
          }
          await sleep(1);
        }
        throw new Error(code);
      };
      const durations = [];
      for (const edge of edges) {
        const root = document.getElementById(
          "fennevia-shell-" + edge + "-root"
        );
        const trigger = root?.querySelector(
          '[data-fennevia-edge-trigger="' + edge + '"]'
        );
        if (!root || !trigger) {
          throw new Error("FENNEVIA_FIREFOX_TEST_EDGE_SHELL_MISSING");
        }
        const rect = frame.getBoundingClientRect();
        const point = edge === "top"
          ? { x: rect.left + rect.width / 2, y: rect.top }
          : edge === "bottom"
            ? { x: rect.left + rect.width / 2, y: rect.bottom - 1 }
            : edge === "left"
              ? { x: rect.left, y: rect.top + rect.height / 2 }
              : { x: rect.right - 1, y: rect.top + rect.height / 2 };
        const dispatch = type => trigger.dispatchEvent(
          new PointerEvent(type, {
            bubbles: true,
            cancelable: true,
            clientX: point.x,
            clientY: point.y,
            pointerId: 1,
            pointerType: "mouse",
          })
        );
        for (let sample = 0; sample < samplesPerEdge; sample += 1) {
          if (root.getAttribute("data-fennevia-visible") === "true") {
            dispatch("pointerout");
            await waitFor(
              () => root.getAttribute("data-fennevia-visible") !== "true",
              "FENNEVIA_FIREFOX_TEST_EDGE_POINTER_HIDE_TIMEOUT"
            );
          }
          const startedAt = performance.now();
          dispatch("pointermove");
          const revealedAt = await waitFor(
            () => root.getAttribute("data-fennevia-visible") === "true",
            "FENNEVIA_FIREFOX_TEST_EDGE_POINTER_REVEAL_TIMEOUT"
          );
          durations.push(revealedAt - startedAt);
          dispatch("pointerout");
          await waitFor(
            () => root.getAttribute("data-fennevia-visible") !== "true",
            "FENNEVIA_FIREFOX_TEST_EDGE_POINTER_HIDE_TIMEOUT"
          );
        }
      }
      durations.sort((left, right) => left - right);
      const percentile = value => durations[
        Math.min(
          durations.length - 1,
          Math.max(0, Math.ceil(durations.length * value) - 1)
        )
      ];
      const round = value => Math.round(value * 1000) / 1000;
      return {
        maxMs: round(durations.at(-1)),
        p50Ms: round(percentile(0.5)),
        p95Ms: round(percentile(0.95)),
        sampleCount: durations.length,
      };
    })();
  `);
}

async function exercisePerformanceWindowCycles(client, originalHandle) {
  for (let cycle = 0; cycle < PERFORMANCE_WINDOW_CYCLES; cycle += 1) {
    const newWindowResult = await client.request("WebDriver:NewWindow", {
      focus: true,
      private: false,
      type: "window",
    });
    const newWindow = newWindowResult.value ?? newWindowResult;
    assert.equal(newWindow.type, "window");
    await waitForState(
      client,
      (state) => state?.managedWindowCount === 2,
      "FENNEVIA_FIREFOX_TEST_PERFORMANCE_WINDOW_OPEN_TIMEOUT",
    );
    await client.request("WebDriver:SwitchToWindow", {
      handle: newWindow.handle,
    });
    await client.request("Marionette:SetContext", { value: "chrome" });
    assertShellHostState(await collectShellHostState(client), "normal");
    await client.request("WebDriver:CloseWindow");
    await client.request("WebDriver:SwitchToWindow", {
      handle: originalHandle,
    });
    await client.request("Marionette:SetContext", { value: "chrome" });
    await waitForState(
      client,
      (state) => state?.managedWindowCount === 1,
      "FENNEVIA_FIREFOX_TEST_PERFORMANCE_WINDOW_CLOSE_TIMEOUT",
    );
  }
}

async function collectPerformanceBaseline(
  client,
  originalHandle,
  startupToActiveMs,
) {
  const idleBefore = await collectProcessResourceSnapshot(client);
  await new Promise((resolve) =>
    setTimeout(resolve, PERFORMANCE_IDLE_WINDOW_MS),
  );
  const idleAfter = await collectProcessResourceSnapshot(client);
  const edgeReveal = await measureEdgeRevealLatency(client);
  const cyclesBefore = await collectProcessResourceSnapshot(client);
  await exercisePerformanceWindowCycles(client, originalHandle);
  await new Promise((resolve) =>
    setTimeout(resolve, PERFORMANCE_SETTLE_WINDOW_MS),
  );
  const cyclesAfter = await collectProcessResourceSnapshot(client);
  const evidence = await collectEvidence(client);
  assert.equal(
    evidence.records.filter((record) => record.level === "error").length,
    0,
  );
  assert.equal(evidence.firstPartyScriptErrorCount, 0);
  assert.equal(
    countEvent(evidence, "window.disposed", "normal"),
    PERFORMANCE_WINDOW_CYCLES,
  );
  assert.equal(
    countEvent(evidence, "shell.hosts-disposed", "normal"),
    PERFORMANCE_WINDOW_CYCLES,
  );
  assert.equal(
    countEvent(evidence, "bridge.boundary-disposed", "normal"),
    PERFORMANCE_WINDOW_CYCLES,
  );

  return {
    schemaVersion: 1,
    startupToActiveMs,
    idle: {
      cpuCycleDelta: idleAfter.cpuCycleCount - idleBefore.cpuCycleCount,
      cpuTimeDeltaNs: idleAfter.cpuTimeNs - idleBefore.cpuTimeNs,
      memoryDeltaBytes: idleAfter.memoryBytes - idleBefore.memoryBytes,
      processCountAfter: idleAfter.processCount,
      processCountBefore: idleBefore.processCount,
      windowMs: PERFORMANCE_IDLE_WINDOW_MS,
    },
    edgeReveal,
    windowCycles: {
      count: PERFORMANCE_WINDOW_CYCLES,
      cpuCycleDelta: cyclesAfter.cpuCycleCount - cyclesBefore.cpuCycleCount,
      cpuTimeDeltaNs: cyclesAfter.cpuTimeNs - cyclesBefore.cpuTimeNs,
      memoryAfterBytes: cyclesAfter.memoryBytes,
      memoryBeforeBytes: cyclesBefore.memoryBytes,
      memoryDeltaBytes: cyclesAfter.memoryBytes - cyclesBefore.memoryBytes,
      processCountAfter: cyclesAfter.processCount,
      processCountBefore: cyclesBefore.processCount,
      settleMs: PERFORMANCE_SETTLE_WINDOW_MS,
    },
  };
}

async function collectNativeState(client) {
  return client.execute(`
    const browserWindow = Services.wm.getMostRecentWindow("navigator:browser");
    return {
      active: browserWindow.document.documentElement.hasAttribute(
        "data-fennevia-active"
      ),
      documentUri: browserWindow.document.documentURI,
      mainWindowId: browserWindow.document.documentElement.id,
      nativeToolboxPresent: Boolean(
        browserWindow.document.getElementById("navigator-toolbox")
      ),
      windowType:
        browserWindow.document.documentElement.getAttribute("windowtype"),
    };
  `);
}

async function collectBrowserDomSnapshot(client) {
  return client.execute(`
    const XHTML_NS = "http://www.w3.org/1999/xhtml";
    const describe = selector => {
      const element = document.querySelector(selector);
      if (!element) {
        return { exists: false, selector };
      }
      const parent = element.parentElement;
      const rect = element.getBoundingClientRect();
      return {
        exists: true,
        hidden: element.hidden || element.hasAttribute("hidden"),
        localName: element.localName,
        namespaceURI: element.namespaceURI,
        parentId: parent?.id || null,
        parentLocalName: parent?.localName || null,
        parentNamespaceURI: parent?.namespaceURI || null,
        rect: {
          bottom: Math.round(rect.bottom),
          height: Math.round(rect.height),
          left: Math.round(rect.left),
          right: Math.round(rect.right),
          top: Math.round(rect.top),
          width: Math.round(rect.width),
        },
        selector,
      };
    };
    const bodyStyle = getComputedStyle(document.body);
    const bodyChildren = Array.from(document.body.children);
    const indexOf = selector => bodyChildren.indexOf(document.querySelector(selector));
    return {
      body: {
        display: bodyStyle.display,
        flexDirection: bodyStyle.flexDirection,
        localName: document.body.localName,
        namespaceURI: document.body.namespaceURI,
      },
      bodyOrder: {
        accessibilityAnnouncement: indexOf("#a11y-announcement"),
        browser: indexOf("#browser"),
        fullscreenToggler: indexOf("#fullscr-toggler"),
        navigatorToolbox: indexOf("#navigator-toolbox"),
        windowModalDialog: indexOf("#window-modal-dialog"),
      },
      documentUri: document.documentURI,
      elements: [
        "html#main-window",
        "#navigator-toolbox",
        "#browser",
        "#sidebar-container",
        "#sidebar-launcher-splitter",
        "#sidebar-box",
        "#sidebar-splitter",
        "#tabbrowser-tabbox",
        "#window-modal-dialog",
        "#a11y-announcement",
        "#fullscr-toggler",
      ].map(describe),
      projectHostCount: document.querySelectorAll('[id^="fennevia-shell-"]').length,
      root: {
        id: document.documentElement.id,
        localName: document.documentElement.localName,
        namespaceURI: document.documentElement.namespaceURI,
      },
      xhtmlNamespace: XHTML_NS,
    };
  `);
}

async function collectShellHostState(client) {
  return client.execute(`
    const XHTML_NS = "http://www.w3.org/1999/xhtml";
    const SVG_NS = "http://www.w3.org/2000/svg";
    const hostIds = [
      "fennevia-shell-frame-host",
      "fennevia-shell-top-host",
      "fennevia-shell-left-host",
      "fennevia-shell-right-host",
      "fennevia-shell-bottom-host",
      "fennevia-shell-address-overlay-host",
    ];
    const edgeNames = ["top", "left", "right", "bottom"];
    const frame = document.getElementById(hostIds[0]);
    const edgeHosts = edgeNames.map(edge =>
      document.getElementById("fennevia-shell-" + edge + "-host")
    );
    const overlayHost = document.getElementById(
      "fennevia-shell-address-overlay-host"
    );
    const overlayTarget = document.getElementById(
      "fennevia-shell-address-overlay-mount"
    );
    const toolbox = document.getElementById("navigator-toolbox");
    const browser = document.getElementById("browser");
    const tabbox = document.getElementById("tabbrowser-tabbox");
    const modalDialog = document.getElementById("window-modal-dialog");
    const style = document.getElementById("fennevia-shell-style");
    const appStyle = document.getElementById("fennevia-shell-app-style");
    const nativeStyle = document.getElementById("fennevia-native-ui-style");
    const nativePopupProxyAnchor = document.getElementById(
      "fennevia-native-popup-anchor"
    );
    const describeNativeLayout = element => {
      if (!element) {
        return null;
      }
      const computed = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return {
        collapsed: element.getAttribute("collapsed") ?? null,
        display: computed.display,
        height: Math.round(rect.height),
        hidden: element.getAttribute("hidden") ?? null,
        visibility: computed.visibility,
        width: Math.round(rect.width),
      };
    };
    const titlebarCloseButtons = [
      ...toolbox?.querySelectorAll(
        '.titlebar-buttonbox-container .titlebar-close[command="cmd_closeWindow"]'
      ) ?? [],
    ];
    let nativeCssRuleCount = 0;
    try {
      nativeCssRuleCount = nativeStyle?.sheet?.cssRules?.length ?? 0;
    } catch {
      nativeCssRuleCount = 0;
    }
    const frameRect = frame?.getBoundingClientRect();
    const browserRect = browser?.getBoundingClientRect();
    const browserChildren = Array.from(browser?.children ?? []);
    const allProjectElements = frame ? [frame, ...frame.querySelectorAll("*")] : [];
    const hasAllowedProjectNamespace = element =>
      element.namespaceURI === XHTML_NS ||
      (element.namespaceURI === SVG_NS &&
        element.closest('svg[data-fennevia-icon]')?.namespaceURI === SVG_NS);
    const contentHit = browserRect
      ? document.elementFromPoint(
          Math.round(browserRect.left + browserRect.width / 2),
          Math.round(browserRect.top + browserRect.height / 2)
        )
      : null;
    return {
      active: document.documentElement.hasAttribute("data-fennevia-active"),
      browserStillPresent: Boolean(browser),
      completeSet: hostIds.every(id => Boolean(document.getElementById(id))),
      contentHitInsideProjectHost: Boolean(
        contentHit?.closest?.('[id^="fennevia-shell-"]')
      ),
      edgeHosts: Object.fromEntries(edgeNames.map((edge, index) => {
        const host = edgeHosts[index];
        const target = document.getElementById(
          "fennevia-shell-" + edge + "-mount"
        );
        const root = document.getElementById(
          "fennevia-shell-" + edge + "-root"
        );
        const panel = root?.querySelector(
          '[data-fennevia-edge-panel="' + edge + '"]'
        );
        const trigger = root?.querySelector(
          '[data-fennevia-edge-trigger="' + edge + '"]'
        );
        return [edge, {
          hostParentIsFrame: host?.parentElement === frame,
          hostPosition: frame ? [...frame.children].filter(
            child => child.hasAttribute("data-fennevia-edge-host")
          ).indexOf(host) : -1,
          mountParentIsHost: target?.parentElement === host,
          mountStatus: target?.getAttribute("data-fennevia-framework-status") ?? null,
          panelHidden: panel?.getAttribute("aria-hidden") === "true",
          panelInert: Boolean(panel?.inert),
          panelPointerEvents: panel ? getComputedStyle(panel).pointerEvents : null,
          rootEdge: root?.getAttribute("data-fennevia-edge") ?? null,
          rootVisible: root?.getAttribute("data-fennevia-visible") ?? null,
          triggerPointerEvents: trigger ? getComputedStyle(trigger).pointerEvents : null,
        }];
      })),
      environment: frame?.getAttribute("data-fennevia-environment") ?? null,
      frame: {
        appStyleParent: appStyle?.parentElement === frame,
        browserGeometryPreserved:
          Math.round(frameRect?.width ?? -1) === Math.round(browserRect?.width ?? -2) &&
          Math.round(frameRect?.height ?? -1) === Math.round(browserRect?.height ?? -2),
        parentIsBrowser: frame?.parentElement === browser,
        pointerEvents: frame ? getComputedStyle(frame).pointerEvents : null,
        position: frame ? getComputedStyle(frame).position : null,
        runtimeStyleParent: style?.parentElement === frame,
      },
      hostCount: hostIds.filter(id => document.getElementById(id)).length,
      hostIdCount: hostIds.reduce(
        (count, id) =>
          count + document.querySelectorAll('[id="' + id + '"]').length,
        0
      ),
      health: {
        created: document.documentElement.hasAttribute("data-fennevia-created"),
        failed: document.documentElement.hasAttribute("data-fennevia-failed"),
        healthy: document.documentElement.hasAttribute("data-fennevia-healthy"),
        mounted: document.documentElement.hasAttribute("data-fennevia-mounted"),
        state: document.documentElement.getAttribute("data-fennevia-state"),
      },
      nativeModalAvailable: Boolean(
        modalDialog && typeof modalDialog.showModal === "function"
      ),
      nativeTabboxStillPresent: Boolean(tabbox),
      nativeWindowControlsPresent: Boolean(
        toolbox?.querySelector(
          '.titlebar-buttonbox-container .titlebar-close[command="cmd_closeWindow"]'
        )
      ),
      nativeUi: {
        identityBoxOwnedByNavBar:
          document.getElementById("identity-box")?.closest("#nav-bar") ===
          document.getElementById("nav-bar"),
        popupProxyAnchorAriaHidden:
          nativePopupProxyAnchor?.getAttribute("aria-hidden") === "true",
        popupProxyAnchorCount: document.querySelectorAll(
          "#fennevia-native-popup-anchor"
        ).length,
        popupProxyAnchorParentIsFrame:
          nativePopupProxyAnchor?.parentElement === frame,
        popupProxyAnchorPointerEvents: nativePopupProxyAnchor
          ? getComputedStyle(nativePopupProxyAnchor).pointerEvents
          : null,
        navBar: describeNativeLayout(document.getElementById("nav-bar")),
        navBarCustomizationTarget: describeNativeLayout(
          document.getElementById("nav-bar-customization-target")
        ),
        notificationsToolbarPresent: Boolean(
          document.getElementById("notifications-toolbar")
        ),
        personalToolbar: describeNativeLayout(
          document.getElementById("PersonalToolbar")
        ),
        revealed: document.documentElement.hasAttribute(
          "data-fennevia-native-ui-revealed"
        ),
        sidebarBox: describeNativeLayout(
          document.getElementById("sidebar-box")
        ),
        sidebarContainer: describeNativeLayout(
          document.getElementById("sidebar-container")
        ),
        sidebarLauncherSplitter: describeNativeLayout(
          document.getElementById("sidebar-launcher-splitter")
        ),
        sidebarSplitter: describeNativeLayout(
          document.getElementById("sidebar-splitter")
        ),
        styleParentIsFrame: nativeStyle?.parentElement === frame,
        styleRuleCount: nativeCssRuleCount,
        suspended: document.documentElement.hasAttribute(
          "data-fennevia-native-ui-suspended"
        ),
        tabsHidden: toolbox?.hasAttribute("tabs-hidden") ?? null,
        tabsToolbarItems: describeNativeLayout(
          document.querySelector("#TabsToolbar > .toolbar-items")
        ),
        titlebarCloseButtonCount: titlebarCloseButtons.length,
        visibleTitlebarCloseButtonCount: titlebarCloseButtons.filter(button => {
          const computed = getComputedStyle(button);
          const rect = button.getBoundingClientRect();
          return computed.display !== "none" &&
            computed.visibility !== "hidden" &&
            computed.visibility !== "collapse" &&
            rect.width > 0 && rect.height > 0;
        }).length,
        trackingProtectionOwnedByNavBar:
          document
            .getElementById("tracking-protection-icon-container")
            ?.closest("#nav-bar") === document.getElementById("nav-bar"),
        urlbarOwnedByNavBar:
          document.getElementById("urlbar")?.closest("#nav-bar") ===
          document.getElementById("nav-bar"),
      },
      namespaceComplete: allProjectElements.every(
        hasAllowedProjectNamespace
      ),
      ownershipComplete: allProjectElements.every(
        element => element === frame || frame?.contains(element)
      ),
      overlay: {
        hostIsLast: frame?.lastElementChild === overlayHost,
        hostParentIsFrame: overlayHost?.parentElement === frame,
        mountParentIsHost: overlayTarget?.parentElement === overlayHost,
        mountStatus:
          overlayTarget?.getAttribute("data-fennevia-framework-status") ?? null,
        popupRootCount:
          overlayTarget?.querySelectorAll("[data-fennevia-address-popup-root]")
            .length ?? 0,
      },
      placement: {
        frameImmediatelyBeforeTabbox:
          browserChildren.indexOf(frame) + 1 === browserChildren.indexOf(tabbox),
      },
      rootCount: edgeNames.filter(
        edge => document.getElementById("fennevia-shell-" + edge + "-root")
      ).length,
      targetCount: edgeNames.filter(
        edge => document.getElementById("fennevia-shell-" + edge + "-mount")
      ).length + Number(Boolean(overlayTarget)),
    };
  `);
}

async function collectFrontendState(client) {
  return client.execute(`
    const XHTML_NS = "http://www.w3.org/1999/xhtml";
    const edgeNames = ["top", "left", "right", "bottom"];
    const frame = document.getElementById("fennevia-shell-frame-host");
    const roots = Object.fromEntries(edgeNames.map(edge => [
      edge,
      document.getElementById("fennevia-shell-" + edge + "-root"),
    ]));
    const mounts = Object.fromEntries(edgeNames.map(edge => [
      edge,
      document.getElementById("fennevia-shell-" + edge + "-mount"),
    ]));
    const root = roots.left;
    const topRoot = roots.top;
    const rightRoot = roots.right;
    const bottomRoot = roots.bottom;
    const overlayMount = document.getElementById(
      "fennevia-shell-address-overlay-mount"
    );
    const popupRoot = document.getElementById("fennevia-address-popup-root");
    const style = document.getElementById("fennevia-shell-app-style");
    const template = roots.top?.querySelector(
      "template[data-fennevia-template]"
    );
    const nativeTabs = Array.isArray(gBrowser?.openTabs)
      ? gBrowser.openTabs
      : [];
    const customTabs = root
      ? [...root.querySelectorAll('button[role="tab"][data-fennevia-tab]')]
      : [];
    const customItems = root
      ? [...root.querySelectorAll(".fennevia-tab-strip__item")]
      : [];
    const addressInput = popupRoot?.querySelector(
      "input[data-fennevia-address-popup-input]"
    );
    let cssRuleCount = 0;
    try {
      cssRuleCount = style?.sheet?.cssRules?.length ?? 0;
    } catch {
      cssRuleCount = 0;
    }
    const elements = edgeNames.flatMap(edge => {
      const edgeRoot = roots[edge];
      return edgeRoot ? [edgeRoot, ...edgeRoot.querySelectorAll("*")] : [];
    });
    if (popupRoot) {
      elements.push(popupRoot, ...popupRoot.querySelectorAll("*"));
    }
    const templateContent = template?.content?.firstElementChild ?? null;
    if (templateContent) {
      elements.push(templateContent);
    }
    return {
      address: {
        connectionDetailCount:
          popupRoot?.querySelectorAll("[data-fennevia-connection-detail]")
            .length ?? 0,
        connectionIndicatorCount:
          root?.querySelectorAll("[data-fennevia-connection-status]").length ??
          0,
        edgeEditableCount:
          root?.querySelectorAll("input, textarea, [contenteditable]").length ??
          0,
        launcherCount:
          root?.querySelectorAll("[data-fennevia-address-launcher]").length ??
          0,
        labelText:
          popupRoot
            ?.querySelector('label[for="fennevia-address-popup-input"]')
            ?.textContent?.trim() ?? null,
        maxLength: addressInput?.maxLength ?? null,
        overlayParentId: overlayMount?.parentElement?.id ?? null,
        overlayStatus:
          overlayMount?.getAttribute("data-fennevia-framework-status") ?? null,
        popupInputCount:
          popupRoot?.querySelectorAll(
            "input[data-fennevia-address-popup-input]"
          ).length ?? 0,
        popupPhase:
          popupRoot?.getAttribute("data-fennevia-address-popup-phase") ?? null,
        popupRootCount: document.querySelectorAll(
          "[data-fennevia-address-popup-root]"
        ).length,
        popupStatusCount:
          popupRoot?.querySelectorAll("[data-fennevia-address-popup-status]")
            .length ?? 0,
        nativeAccessCount:
          popupRoot?.querySelectorAll("[data-fennevia-native-urlbar-access]")
            .length ?? 0,
        permissionDetailCount:
          popupRoot?.querySelectorAll("[data-fennevia-permission-detail]")
            .length ?? 0,
        protectionDetailCount:
          popupRoot?.querySelectorAll("[data-fennevia-protection-detail]")
            .length ?? 0,
        protectionIndicatorCount:
          root?.querySelectorAll("[data-fennevia-protection-status]").length ??
          0,
        urlbarCoverageCount:
          popupRoot?.querySelectorAll("[data-fennevia-urlbar-coverage]")
            .length ?? 0,
      },
      bookmarks: {
        branchReadyCount:
          rightRoot?.querySelectorAll(
            '[data-fennevia-bookmark-branch-phase="ready"]'
          ).length ?? 0,
        itemCount:
          rightRoot?.querySelectorAll("[data-fennevia-bookmark-item]")
            .length ?? 0,
        linkAttributeCount:
          rightRoot?.querySelectorAll("[href], [src], [data-url]").length ?? 0,
        listCount:
          rightRoot?.querySelectorAll("[data-fennevia-bookmark-list]")
            .length ?? 0,
        listRole:
          rightRoot
            ?.querySelector("[data-fennevia-bookmark-list]")
            ?.getAttribute("role") ?? null,
        panelCount:
          rightRoot?.querySelectorAll("[data-fennevia-bookmarks]").length ?? 0,
        rootCount:
          rightRoot?.querySelectorAll("[data-fennevia-bookmark-root]")
            .length ?? 0,
        rootSelectCount:
          rightRoot?.querySelectorAll("select[data-fennevia-bookmark-roots]")
            .length ?? 0,
        rootSelectedCount:
          rightRoot?.querySelectorAll(
            "option[data-fennevia-bookmark-root]:checked"
          ).length ?? 0,
        rootsTagName:
          rightRoot?.querySelector("[data-fennevia-bookmark-roots]")
            ?.tagName ?? null,
        statusCount:
          rightRoot?.querySelectorAll("[data-fennevia-bookmark-status]")
            .length ?? 0,
      },
      downloads: {
        forbiddenAttributeCount:
          bottomRoot?.querySelectorAll(
            "[href], [src], [data-url], [data-path], [data-filename]"
          ).length ?? 0,
        itemCount:
          bottomRoot?.querySelectorAll("[data-fennevia-download-state]")
            .length ?? 0,
        panelCount:
          bottomRoot?.querySelectorAll("[data-fennevia-downloads]").length ??
          0,
        phase:
          bottomRoot
            ?.querySelector("[data-fennevia-downloads]")
            ?.getAttribute("data-fennevia-downloads-phase") ?? null,
        progressCount:
          bottomRoot?.querySelectorAll("[data-fennevia-download-progress]")
            .length ?? 0,
        summaryCount:
          bottomRoot?.querySelectorAll("[data-fennevia-download-summary]")
            .length ?? 0,
        summaryText:
          bottomRoot
            ?.querySelector("[data-fennevia-download-summary]")
            ?.textContent?.trim() ?? null,
      },
      progressLights: {
        downloadAriaHidden:
          bottomRoot
            ?.querySelector('[data-fennevia-progress-light="download"]')
            ?.getAttribute("aria-hidden") ?? null,
        downloadCount:
          bottomRoot?.querySelectorAll(
            '[data-fennevia-progress-light="download"]'
          ).length ?? 0,
        downloadMode:
          bottomRoot
            ?.querySelector('[data-fennevia-progress-light="download"]')
            ?.getAttribute("data-fennevia-progress-mode") ?? null,
        downloadVisible:
          bottomRoot
            ?.querySelector('[data-fennevia-progress-light="download"]')
            ?.getAttribute("data-fennevia-progress-visible") ?? null,
        loadAriaHidden:
          topRoot
            ?.querySelector('[data-fennevia-progress-light="load"]')
            ?.getAttribute("aria-hidden") ?? null,
        loadCount:
          topRoot?.querySelectorAll('[data-fennevia-progress-light="load"]')
            .length ?? 0,
        loadMode:
          topRoot
            ?.querySelector('[data-fennevia-progress-light="load"]')
            ?.getAttribute("data-fennevia-progress-mode") ?? null,
        loadVisible:
          topRoot
            ?.querySelector('[data-fennevia-progress-light="load"]')
            ?.getAttribute("data-fennevia-progress-visible") ?? null,
      },
      allElementsUseXhtml: elements.every(
        element => element.namespaceURI === XHTML_NS
      ),
      actionControlsNamed: elements
        .filter(element => element.matches?.(
          '.fennevia-tab-strip__action, [data-fennevia-navigation] button, [data-fennevia-action="new-tab"]'
        ))
        .every(control => Boolean(control.getAttribute("aria-label"))),
      customTabCount: customTabs.length,
      frameEnvironment: frame?.getAttribute("data-fennevia-environment") ?? null,
      frameReady: frame?.hasAttribute("data-fennevia-frontend-ready") ?? false,
      landmarks: Object.fromEntries(edgeNames.map(edge => {
        const edgeRoot = roots[edge];
        const panel = edgeRoot?.querySelector(
          '[data-fennevia-edge-panel="' + edge + '"]'
        );
        return [edge, {
          dismissCount: edgeRoot?.querySelectorAll(
            '[data-fennevia-dismiss="' + edge + '"]'
          ).length ?? 0,
          hidden: panel?.getAttribute("aria-hidden") ?? null,
          inert: Boolean(panel?.inert),
          label: panel?.getAttribute("aria-label") ?? null,
          phase: edgeRoot?.getAttribute("data-fennevia-phase") ?? null,
          role: panel?.getAttribute("role") ?? null,
          triggerCount: edgeRoot?.querySelectorAll(
            '[data-fennevia-edge-trigger="' + edge + '"]'
          ).length ?? 0,
          visible: edgeRoot?.getAttribute("data-fennevia-visible") ?? null,
        }];
      })),
      mounts: Object.fromEntries(edgeNames.map(edge => [edge, {
        parentId: mounts[edge]?.parentElement?.id ?? null,
        status: mounts[edge]?.getAttribute(
          "data-fennevia-framework-status"
        ) ?? null,
      }])),
      nativeTabCount: nativeTabs.length,
      navigation: {
        backDisabled:
          topRoot?.querySelector('[data-fennevia-action="back"]')?.disabled ??
          null,
        backMatchesNative:
          topRoot?.querySelector('[data-fennevia-action="back"]')?.disabled ===
          document.getElementById("Browser:Back")?.hasAttribute("disabled"),
        controlCount:
          topRoot?.querySelectorAll("[data-fennevia-navigation] button").length ??
          0,
        editableCount:
          topRoot?.querySelectorAll("input, textarea, [contenteditable]").length ??
          0,
        forwardDisabled:
          topRoot?.querySelector('[data-fennevia-action="forward"]')?.disabled ??
          null,
        forwardMatchesNative:
          topRoot?.querySelector('[data-fennevia-action="forward"]')?.disabled ===
          document.getElementById("Browser:Forward")?.hasAttribute("disabled"),
        loadingMatchesNative:
          topRoot
            ?.querySelector('[data-fennevia-action="reload-stop"]')
            ?.getAttribute("data-fennevia-loading") ===
          String(
            !document.getElementById("Browser:Stop")?.hasAttribute("disabled")
          ),
        menuCount:
          topRoot?.querySelectorAll(
            '[aria-haspopup], [role="menu"], [data-fennevia-action*="menu"]'
          ).length ?? 0,
        statusCount:
          topRoot?.querySelectorAll("[data-fennevia-navigation-status]")
            .length ?? 0,
        tabCount:
          topRoot?.querySelectorAll('[role="tab"], [role="tablist"]').length ??
          0,
      },
      nestedInteractiveCount: customTabs.filter(tab =>
        tab.querySelector("button, input, select, textarea, a[href]")
      ).length,
      newTabControlCount:
        root?.querySelectorAll('[data-fennevia-action="new-tab"]').length ??
        0,
      rovingTabCount: customTabs.filter(tab => tab.tabIndex === 0).length,
      selectedMatchesNative:
        customTabs.findIndex(tab => tab.getAttribute("aria-selected") === "true") ===
        nativeTabs.indexOf(gBrowser?.selectedTab),
      stateMatchesNative:
        customItems.length === nativeTabs.length &&
        customItems.every((item, index) => {
          const nativeTab = nativeTabs[index];
          return (
            item.getAttribute("data-fennevia-loading") ===
              String(nativeTab?.hasAttribute("busy")) &&
            item.getAttribute("data-fennevia-pinned") ===
              String(nativeTab?.hasAttribute("pinned")) &&
            item.getAttribute("data-fennevia-selected") ===
              String(nativeTab === gBrowser?.selectedTab)
          );
        }),
      tabAccessibleNamesComplete: customTabs.every(tab =>
        Boolean(tab.getAttribute("aria-label"))
      ),
      tabOrderMatchesNative:
        customTabs.length === nativeTabs.length &&
        customTabs.every((tab, index) => {
          const nativeTitle = String(
            nativeTabs[index]?.getAttribute("label") ?? ""
          );
          const expectedTitle = nativeTitle.trim()
            ? nativeTitle
            : "Untitled tab";
          return tab.getAttribute("title") === expectedTitle;
        }),
      tabListRole:
        root
          ?.querySelector("[data-fennevia-tab-list]")
          ?.getAttribute("role") ?? null,
      tabListOrientation:
        root
          ?.querySelector("[data-fennevia-tab-list]")
          ?.getAttribute("aria-orientation") ?? null,
      registrationCallbackPresent: Object.hasOwn(
        window,
        "__fenneviaRegisterShellFrontend"
      ),
      rootCount: document.querySelectorAll(
        "[data-fennevia-surface-root]"
      ).length,
      styleParentIsFrame: style?.parentElement === frame,
      styleRuleCount: cssRuleCount,
      tabCount:
        root?.querySelector("[data-fennevia-tab-count]")?.textContent?.trim() ??
        null,
      template: {
        contentNamespace: templateContent?.namespaceURI ?? null,
        contentText: templateContent?.textContent?.trim() ?? null,
        instance: Boolean(
          template && template instanceof window.HTMLTemplateElement
        ),
        namespace: template?.namespaceURI ?? null,
      },
      windowKinds: edgeNames.map(
        edge => roots[edge]?.getAttribute("data-fennevia-window-kind") ?? null
      ),
      xhtmlNamespace: XHTML_NS,
    };
  `);
}

function assertFrontendState(state, windowKind) {
  assert.deepEqual(state.address, {
    connectionDetailCount: 1,
    connectionIndicatorCount: 1,
    edgeEditableCount: 0,
    launcherCount: 1,
    labelText: "Enter an address or search",
    maxLength: 4096,
    overlayParentId: "fennevia-shell-address-overlay-host",
    overlayStatus: "mounted",
    popupInputCount: 1,
    popupPhase: "hidden",
    popupRootCount: 1,
    popupStatusCount: 1,
    nativeAccessCount: 1,
    permissionDetailCount: 1,
    protectionDetailCount: 1,
    protectionIndicatorCount: 1,
    urlbarCoverageCount: 1,
  });
  assert.ok(state.bookmarks.branchReadyCount >= 1);
  assert.equal(Number.isSafeInteger(state.bookmarks.itemCount), true);
  assert.equal(state.bookmarks.linkAttributeCount, 0);
  assert.equal(state.bookmarks.listCount, 1);
  assert.equal(state.bookmarks.listRole, "list");
  assert.equal(state.bookmarks.panelCount, 1);
  assert.equal(state.bookmarks.rootCount, 4);
  assert.equal(state.bookmarks.rootSelectCount, 1);
  assert.equal(state.bookmarks.rootSelectedCount, 1);
  assert.equal(state.bookmarks.rootsTagName, "SELECT");
  assert.equal(state.bookmarks.statusCount, 1);
  assert.equal(state.downloads.forbiddenAttributeCount, 0);
  assert.ok(state.downloads.itemCount >= 0 && state.downloads.itemCount <= 6);
  assert.equal(state.downloads.panelCount, 1);
  assert.equal(state.downloads.phase, "ready");
  assert.equal(state.downloads.progressCount, 1);
  assert.equal(state.downloads.summaryCount, 1);
  assert.equal(typeof state.downloads.summaryText, "string");
  assert.deepEqual(state.progressLights, {
    downloadAriaHidden: "true",
    downloadCount: 1,
    downloadMode: "idle",
    downloadVisible: "false",
    loadAriaHidden: "true",
    loadCount: 1,
    loadMode: "idle",
    loadVisible: "false",
  });
  assert.equal(state.allElementsUseXhtml, true);
  assert.equal(state.actionControlsNamed, true);
  assert.equal(state.customTabCount, state.nativeTabCount);
  assert.equal(state.frameEnvironment, "normal");
  assert.equal(state.frameReady, true);
  for (const edge of ["top", "left", "right", "bottom"]) {
    assert.deepEqual(state.landmarks[edge], {
      dismissCount: 0,
      hidden: "true",
      inert: true,
      label:
        edge === "top"
          ? "Browser controls"
          : edge === "left"
            ? "Tabs and address"
            : edge === "right"
              ? "Bookmarks"
              : "Downloads",
      phase: "hidden",
      role: "region",
      triggerCount: 1,
      visible: "false",
    });
    assert.deepEqual(state.mounts[edge], {
      parentId: `fennevia-shell-${edge}-host`,
      status: "mounted",
    });
  }
  assert.equal(state.nestedInteractiveCount, 0);
  assert.equal(typeof state.navigation.backDisabled, "boolean");
  assert.equal(state.navigation.backMatchesNative, true);
  assert.equal(state.navigation.controlCount, 14);
  assert.equal(state.navigation.editableCount, 0);
  assert.equal(typeof state.navigation.forwardDisabled, "boolean");
  assert.equal(state.navigation.forwardMatchesNative, true);
  assert.equal(state.navigation.loadingMatchesNative, true);
  assert.equal(state.navigation.menuCount, 0);
  assert.equal(state.navigation.statusCount, 1);
  assert.equal(state.navigation.tabCount, 0);
  assert.equal(state.newTabControlCount, 1);
  assert.equal(state.rovingTabCount, 1);
  assert.equal(state.selectedMatchesNative, true);
  assert.equal(state.stateMatchesNative, true);
  assert.equal(state.tabAccessibleNamesComplete, true);
  assert.equal(state.tabListRole, "tablist");
  assert.equal(state.tabListOrientation, "vertical");
  assert.equal(state.tabOrderMatchesNative, true);
  assert.equal(state.registrationCallbackPresent, false);
  assert.equal(state.rootCount, 4);
  assert.equal(state.styleParentIsFrame, true);
  assert.ok(state.styleRuleCount > 0);
  assert.equal(state.tabCount, String(state.nativeTabCount));
  assert.deepEqual(state.template, {
    contentNamespace: state.xhtmlNamespace,
    contentText: "Fennevia XHTML template probe",
    instance: true,
    namespace: state.xhtmlNamespace,
  });
  assert.deepEqual(state.windowKinds, Array(4).fill(windowKind));
}

async function waitForFrontendTabCount(client, expectedCount) {
  const deadline = Date.now() + STATE_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const state = await collectFrontendState(client);
    if (
      state.tabCount === String(expectedCount) &&
      state.nativeTabCount === expectedCount
    ) {
      return state;
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error("FENNEVIA_FIREFOX_TEST_TAB_STATE_TIMEOUT");
}

async function exerciseEdgeShell(client) {
  return client.execute(`
    return (async () => {
      const edgeNames = ["top", "left", "right", "bottom"];
      const keyByEdge = {
        top: "ArrowUp",
        left: "ArrowLeft",
        right: "ArrowRight",
        bottom: "ArrowDown",
      };
      const frame = document.getElementById("fennevia-shell-frame-host");
      const browser = document.getElementById("browser");
      const roots = Object.fromEntries(edgeNames.map(edge => [
        edge,
        document.getElementById("fennevia-shell-" + edge + "-root"),
      ]));
      if (!frame || !browser || edgeNames.some(edge => !roots[edge])) {
        throw new Error("FENNEVIA_FIREFOX_TEST_EDGE_SHELL_MISSING");
      }

      const sleep = delay => new Promise(
        resolve => window.setTimeout(resolve, delay)
      );
      const visible = edge =>
        roots[edge].getAttribute("data-fennevia-visible") === "true";
      const waitFor = async (predicate, code) => {
        const deadline = Date.now() + 3000;
        while (Date.now() < deadline) {
          if (predicate()) {
            return;
          }
          await sleep(20);
        }
        throw new Error(code);
      };
      const trigger = edge => roots[edge].querySelector(
        '[data-fennevia-edge-trigger="' + edge + '"]'
      );
      const coordinates = edge => {
        const rect = frame.getBoundingClientRect();
        if (edge === "top") {
          return { x: rect.left + rect.width / 2, y: rect.top };
        }
        if (edge === "bottom") {
          return { x: rect.left + rect.width / 2, y: rect.bottom - 1 };
        }
        if (edge === "left") {
          return { x: rect.left, y: rect.top + rect.height / 2 };
        }
        return { x: rect.right - 1, y: rect.top + rect.height / 2 };
      };
      const dispatchPointer = (edge, type, point = coordinates(edge)) => {
        trigger(edge).dispatchEvent(
          new PointerEvent(type, {
            bubbles: true,
            cancelable: true,
            clientX: point.x,
            clientY: point.y,
            pointerId: 1,
            pointerType: "mouse",
          })
        );
      };
      const revealWithPointer = async edge => {
        dispatchPointer(edge, "pointermove");
        await waitFor(
          () => visible(edge),
          "FENNEVIA_FIREFOX_TEST_EDGE_POINTER_REVEAL_TIMEOUT"
        );
      };
      const releasePointer = async edge => {
        dispatchPointer(edge, "pointerout");
        await waitFor(
          () => !visible(edge),
          "FENNEVIA_FIREFOX_TEST_EDGE_POINTER_HIDE_TIMEOUT"
        );
      };
      const dispatchKeyboard = key => window.dispatchEvent(
        new KeyboardEvent("keydown", {
          altKey: true,
          bubbles: true,
          cancelable: true,
          ctrlKey: true,
          key,
          shiftKey: true,
        })
      );
      const dispatchEscape = () => window.dispatchEvent(
        new KeyboardEvent("keydown", {
          bubbles: true,
          cancelable: true,
          key: "Escape",
        })
      );
      const overlaps = (first, second) =>
        first.left < second.right &&
        first.right > second.left &&
        first.top < second.bottom &&
        first.bottom > second.top;

      const initialHidden = edgeNames.every(edge => !visible(edge));
      const browserRectBefore = browser.getBoundingClientRect();
      const pointerReveal = {};
      const pendingHidePhases = {};
      for (const edge of edgeNames) {
        await revealWithPointer(edge);
        pointerReveal[edge] =
          visible(edge) && edgeNames
            .filter(candidate => candidate !== edge)
            .every(candidate => !visible(candidate));
        dispatchPointer(edge, "pointerout");
        await waitFor(
          () =>
            roots[edge].getAttribute("data-fennevia-phase") ===
            "pending-hide",
          "FENNEVIA_FIREFOX_TEST_EDGE_PENDING_HIDE_TIMEOUT"
        );
        pendingHidePhases[edge] =
          roots[edge].getAttribute("data-fennevia-phase");
        await waitFor(
          () => !visible(edge),
          "FENNEVIA_FIREFOX_TEST_EDGE_HIDE_TIMEOUT"
        );
      }

      await revealWithPointer("top");
      dispatchPointer("top", "pointerout");
      await sleep(60);
      dispatchPointer("top", "pointermove");
      await sleep(180);
      const reentryCancelledHide = visible("top");
      await releasePointer("top");

      const frameRect = frame.getBoundingClientRect();
      const topLeft = { x: frameRect.left, y: frameRect.top };
      dispatchPointer("left", "pointermove", topLeft);
      await sleep(30);
      const leftIgnoredTopCorner = !visible("top") && !visible("left");
      dispatchPointer("top", "pointermove", topLeft);
      await waitFor(
        () => visible("top"),
        "FENNEVIA_FIREFOX_TEST_TOP_LEFT_CORNER_TIMEOUT"
      );
      const topLeftOwnedByTop = visible("top") && !visible("left");
      await releasePointer("top");

      const bottomRight = {
        x: frameRect.right - 1,
        y: frameRect.bottom - 1,
      };
      dispatchPointer("bottom", "pointermove", bottomRight);
      await sleep(30);
      const bottomIgnoredOwnedCorner = !visible("bottom") && !visible("right");
      dispatchPointer("right", "pointermove", bottomRight);
      await waitFor(
        () => visible("right"),
        "FENNEVIA_FIREFOX_TEST_BOTTOM_RIGHT_CORNER_TIMEOUT"
      );
      const bottomRightOwnedByRight = visible("right") && !visible("bottom");
      await releasePointer("right");

      const focusOrigin = gBrowser.selectedBrowser;
      if (!focusOrigin || typeof focusOrigin.focus !== "function") {
        throw new Error("FENNEVIA_FIREFOX_TEST_FOCUS_ORIGIN_MISSING");
      }
      const keyboardReveal = {};
      const focusRestoration = {};
      const focusHold = {};
      for (const edge of edgeNames) {
        focusOrigin.focus();
        dispatchKeyboard(keyByEdge[edge]);
        await waitFor(
          () => visible(edge),
          "FENNEVIA_FIREFOX_TEST_EDGE_KEYBOARD_REVEAL_TIMEOUT"
        );
        keyboardReveal[edge] = roots[edge].contains(document.activeElement);
        await sleep(220);
        focusHold[edge] = visible(edge);
        dispatchEscape();
        await waitFor(
          () => !visible(edge),
          "FENNEVIA_FIREFOX_TEST_EDGE_ESCAPE_TIMEOUT"
        );
        focusRestoration[edge] = document.activeElement === focusOrigin;
      }

      focusOrigin.focus();
      await revealWithPointer("top");
      dispatchKeyboard(keyByEdge.left);
      await waitFor(
        () => visible("top") && visible("left"),
        "FENNEVIA_FIREFOX_TEST_TWO_EDGE_HOLD_TIMEOUT"
      );
      const topPanel = roots.top.querySelector(
        '[data-fennevia-edge-panel="top"]'
      );
      const leftPanel = roots.left.querySelector(
        '[data-fennevia-edge-panel="left"]'
      );
      const twoHeldWithoutOverlap = !overlaps(
        topPanel.getBoundingClientRect(),
        leftPanel.getBoundingClientRect()
      );
      dispatchEscape();
      await releasePointer("top");

      await revealWithPointer("bottom");
      window.dispatchEvent(
        new PointerEvent("pointerout", {
          bubbles: true,
          relatedTarget: null,
        })
      );
      await waitFor(
        () => !visible("bottom"),
        "FENNEVIA_FIREFOX_TEST_WINDOW_POINTER_LEAVE_TIMEOUT"
      );
      const windowPointerLeaveHides = true;

      const environment = {};
      const documentRoot = document.documentElement;
      try {
        documentRoot.setAttribute("customizing", "");
        await waitFor(
          () => frame.getAttribute("data-fennevia-environment") === "customize-mode",
          "FENNEVIA_FIREFOX_TEST_CUSTOMIZE_MODE_TIMEOUT"
        );
        environment.customize =
          getComputedStyle(frame).visibility === "hidden" &&
          edgeNames.every(edge =>
            roots[edge].getAttribute("data-fennevia-phase") === "disabled"
          );
      } finally {
        documentRoot.removeAttribute("customizing");
      }
      await waitFor(
        () => frame.getAttribute("data-fennevia-environment") === "normal",
        "FENNEVIA_FIREFOX_TEST_CUSTOMIZE_EXIT_TIMEOUT"
      );
      try {
        documentRoot.setAttribute("inDOMFullscreen", "");
        await waitFor(
          () => frame.getAttribute("data-fennevia-environment") === "dom-fullscreen",
          "FENNEVIA_FIREFOX_TEST_DOM_FULLSCREEN_TIMEOUT"
        );
        environment.domFullscreen =
          getComputedStyle(frame).visibility === "hidden";
      } finally {
        documentRoot.removeAttribute("inDOMFullscreen");
      }
      await waitFor(
        () => frame.getAttribute("data-fennevia-environment") === "normal",
        "FENNEVIA_FIREFOX_TEST_DOM_FULLSCREEN_EXIT_TIMEOUT"
      );
      try {
        documentRoot.setAttribute("inFullscreen", "");
        await waitFor(
          () => frame.hasAttribute("data-fennevia-browser-fullscreen"),
          "FENNEVIA_FIREFOX_TEST_BROWSER_FULLSCREEN_TIMEOUT"
        );
        environment.browserFullscreen =
          frame.getAttribute("data-fennevia-environment") === "normal";
      } finally {
        documentRoot.removeAttribute("inFullscreen");
      }
      await waitFor(
        () => !frame.hasAttribute("data-fennevia-browser-fullscreen"),
        "FENNEVIA_FIREFOX_TEST_BROWSER_FULLSCREEN_EXIT_TIMEOUT"
      );

      const browserRectAfter = browser.getBoundingClientRect();
      return {
        bottomIgnoredOwnedCorner,
        bottomRightOwnedByRight,
        browserGeometryPreserved:
          browserRectBefore.width === browserRectAfter.width &&
          browserRectBefore.height === browserRectAfter.height,
        environment,
        focusHold,
        focusRestoration,
        initialHidden,
        keyboardReveal,
        leftIgnoredTopCorner,
        pendingHidePhases,
        pointerReveal,
        reentryCancelledHide,
        topLeftOwnedByTop,
        twoHeldWithoutOverlap,
        windowPointerLeaveHides,
      };
    })();
  `);
}

function assertEdgeShellInteraction(result) {
  const allTrue = Object.fromEntries(
    ["top", "left", "right", "bottom"].map((edge) => [edge, true]),
  );
  const expected = {
    bottomIgnoredOwnedCorner: true,
    bottomRightOwnedByRight: true,
    browserGeometryPreserved: true,
    environment: {
      browserFullscreen: true,
      customize: true,
      domFullscreen: true,
    },
    focusHold: allTrue,
    focusRestoration: allTrue,
    initialHidden: true,
    keyboardReveal: allTrue,
    leftIgnoredTopCorner: true,
    pendingHidePhases: Object.fromEntries(
      ["top", "left", "right", "bottom"].map((edge) => [edge, "pending-hide"]),
    ),
    pointerReveal: allTrue,
    reentryCancelledHide: true,
    topLeftOwnedByTop: true,
    twoHeldWithoutOverlap: true,
    windowPointerLeaveHides: true,
  };
  try {
    assert.deepEqual(result, expected);
  } catch (error) {
    console.error(
      `edgeShellDiagnostics=${JSON.stringify({ expected, result })}`,
    );
    throw error;
  }
}

async function exerciseNavigationControls(client) {
  const requests = { broken: 0, first: 0, reload: 0, second: 0, slow: 0 };
  const responseTimers = new Set();
  const longTitle = `${"Navigation title ".repeat(24)}<status-text-only>`;
  const server = createServer((request, response) => {
    const pathname = new URL(request.url ?? "/", "http://127.0.0.1").pathname;
    if (pathname === "/broken") {
      requests.broken += 1;
      request.socket.destroy();
      return;
    }
    if (pathname === "/slow") {
      requests.slow += 1;
      response.writeHead(200, {
        "Cache-Control": "no-store",
        "Content-Type": "text/html; charset=utf-8",
      });
      response.write("<!doctype html><title>Slow local page</title><p>loading");
      const timer = setTimeout(() => {
        responseTimers.delete(timer);
        if (!response.writableEnded) {
          response.end(" complete</p>");
        }
      }, 5_000);
      responseTimers.add(timer);
      return;
    }
    if (pathname === "/reload") {
      requests.reload += 1;
      response.writeHead(200, {
        "Cache-Control": "no-store",
        "Content-Type": "text/html; charset=utf-8",
      });
      response.write(
        "<!doctype html><title>Reload local page</title><main>reload",
      );
      const timer = setTimeout(() => {
        responseTimers.delete(timer);
        if (!response.writableEnded) {
          response.end(" complete</main>");
        }
      }, 500);
      responseTimers.add(timer);
      return;
    }
    const isSecond = pathname === "/second";
    requests[isSecond ? "second" : "first"] += 1;
    response.writeHead(200, {
      "Cache-Control": "no-store",
      "Content-Type": "text/html; charset=utf-8",
    });
    response.end(
      `<!doctype html><title>${isSecond ? longTitle.replaceAll("<", "&lt;").replaceAll(">", "&gt;") : "First local page"}</title><main>${isSecond ? "second" : "first"}</main>`,
    );
  });

  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("FENNEVIA_FIREFOX_TEST_NAVIGATION_SERVER_INVALID");
  }
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    const result = await client.execute(`
      return (async () => {
        const baseUrl = ${JSON.stringify(baseUrl)};
        const root = document.getElementById("fennevia-shell-top-root");
        const leftRoot = document.getElementById("fennevia-shell-left-root");
        const panel = root?.querySelector('[data-fennevia-edge-panel="top"]');
        const controls = {
          back: root?.querySelector('[data-fennevia-action="back"]'),
          forward: root?.querySelector('[data-fennevia-action="forward"]'),
          newTab: leftRoot?.querySelector('[data-fennevia-action="new-tab"]'),
          reloadStop: root?.querySelector(
            '[data-fennevia-action="reload-stop"]'
          ),
        };
        const status = root?.querySelector(
          "[data-fennevia-navigation-status]"
        );
        const loadLight = () =>
          root?.querySelector('[data-fennevia-progress-light="load"]');
        if (
          !root ||
          !leftRoot ||
          !panel ||
          !controls.back ||
          !controls.forward ||
          !controls.newTab ||
          !controls.reloadStop ||
          !status
        ) {
          throw new Error("FENNEVIA_FIREFOX_TEST_NAVIGATION_CONTROLS_MISSING");
        }

        const waitFor = async (predicate, code, timeoutMs = 8000) => {
          const deadline = Date.now() + timeoutMs;
          while (Date.now() < deadline) {
            if (predicate()) {
              return;
            }
            await new Promise(resolve => window.setTimeout(resolve, 20));
          }
          throw new Error(code);
        };
        const currentSpec = () => gBrowser.selectedBrowser.currentURI.spec;
        const currentStatusUri = () =>
          status.querySelector("span")?.textContent ?? "";
        const load = async url => {
          gBrowser.selectedBrowser.fixupAndLoadURIString(url, {
            triggeringPrincipal:
              Services.scriptSecurityManager.getSystemPrincipal(),
          });
          await waitFor(
            () =>
              currentSpec() === url &&
              !gBrowser.selectedTab.hasAttribute("busy") &&
              currentStatusUri() === url,
            "FENNEVIA_FIREFOX_TEST_NAVIGATION_LOAD_TIMEOUT"
          );
        };

        window.dispatchEvent(
          new KeyboardEvent("keydown", {
            altKey: true,
            bubbles: true,
            ctrlKey: true,
            key: "ArrowUp",
            shiftKey: true,
          })
        );
        await waitFor(
          () =>
            root.getAttribute("data-fennevia-visible") === "true" &&
            root.contains(document.activeElement),
          "FENNEVIA_FIREFOX_TEST_NAVIGATION_KEYBOARD_REVEAL_TIMEOUT"
        );
        const keyboardRevealFocused = root.contains(document.activeElement);

        window.dispatchEvent(
          new KeyboardEvent("keydown", {
            altKey: true,
            bubbles: true,
            ctrlKey: true,
            key: "ArrowLeft",
            shiftKey: true,
          })
        );
        await waitFor(
          () =>
            leftRoot.getAttribute("data-fennevia-visible") === "true" &&
            !controls.newTab.closest("[inert]"),
          "FENNEVIA_FIREFOX_TEST_NAVIGATION_LEFT_REVEAL_TIMEOUT"
        );

        const initialTabCount = gBrowser.openTabs.length;
        const initialSelectedTab = gBrowser.selectedTab;
        controls.newTab.click();
        await waitFor(
          () =>
            gBrowser.openTabs.length === initialTabCount + 1 &&
            gBrowser.selectedTab !== initialSelectedTab &&
            currentStatusUri() === gBrowser.currentURI.displaySpec,
          "FENNEVIA_FIREFOX_TEST_NAVIGATION_NEW_TAB_TIMEOUT"
        );
        const openedTab = gBrowser.selectedTab;
        const newTabSelected = openedTab !== initialSelectedTab;

        const firstUrl = baseUrl + "/first";
        const reloadUrl = baseUrl + "/reload";
        const secondUrl = baseUrl + "/second";
        const slowUrl = baseUrl + "/slow";
        const brokenUrl = baseUrl + "/broken";
        await load(firstUrl);
        await load(secondUrl);
        await waitFor(
          () =>
            !controls.back.disabled &&
            controls.back.disabled ===
              document.getElementById("Browser:Back").hasAttribute("disabled"),
          "FENNEVIA_FIREFOX_TEST_NAVIGATION_BACK_STATE_TIMEOUT"
        );
        const boundedTitleLength =
          status.querySelector("strong")?.textContent?.length ?? 0;
        const titleRenderedAsText =
          boundedTitleLength <= 256 && status.querySelector("img") === null;

        controls.back.click();
        await waitFor(
          () => currentSpec() === firstUrl && !controls.forward.disabled,
          "FENNEVIA_FIREFOX_TEST_NAVIGATION_BACK_TIMEOUT"
        );
        const customBackWorked = currentSpec() === firstUrl;
        BrowserCommands.forward();
        await waitFor(
          () => currentSpec() === secondUrl,
          "FENNEVIA_FIREFOX_TEST_NAVIGATION_NATIVE_FORWARD_TIMEOUT"
        );
        BrowserCommands.back();
        await waitFor(
          () => currentSpec() === firstUrl,
          "FENNEVIA_FIREFOX_TEST_NAVIGATION_NATIVE_BACK_TIMEOUT"
        );
        controls.forward.click();
        await waitFor(
          () =>
            currentSpec() === secondUrl &&
            !gBrowser.selectedTab.hasAttribute("busy"),
          "FENNEVIA_FIREFOX_TEST_NAVIGATION_FORWARD_TIMEOUT"
        );
        const alternatingNativeCustomWorked = currentSpec() === secondUrl;

        await load(reloadUrl);

        let reloadStarted = false;
        let reloadStopped = false;
        const reloadBrowser = gBrowser.selectedBrowser;
        const progressListener = {
          onStateChange(browser, progress, request, flags) {
            if (browser !== reloadBrowser || !progress.isTopLevel) {
              return;
            }
            if (
              flags & Ci.nsIWebProgressListener.STATE_START &&
              flags & Ci.nsIWebProgressListener.STATE_IS_NETWORK
            ) {
              reloadStarted = true;
            }
            if (
              flags & Ci.nsIWebProgressListener.STATE_STOP &&
              flags & Ci.nsIWebProgressListener.STATE_IS_NETWORK
            ) {
              reloadStopped = true;
            }
          },
        };
        gBrowser.addTabsProgressListener(progressListener);
        try {
          controls.reloadStop.click();
          await waitFor(
            () => reloadStarted && reloadStopped,
            "FENNEVIA_FIREFOX_TEST_NAVIGATION_RELOAD_TIMEOUT"
          );
        } finally {
          gBrowser.removeTabsProgressListener(progressListener);
        }

        gBrowser.selectedBrowser.fixupAndLoadURIString(slowUrl, {
          triggeringPrincipal:
            Services.scriptSecurityManager.getSystemPrincipal(),
        });
        await waitFor(
          () =>
            controls.reloadStop.title === "Stop" &&
            controls.reloadStop.getAttribute("data-fennevia-loading") === "true" &&
            loadLight()?.getAttribute("data-fennevia-progress-visible") ===
              "true" &&
            loadLight()?.getAttribute("data-fennevia-progress-mode") ===
              "indeterminate",
          "FENNEVIA_FIREFOX_TEST_NAVIGATION_STOP_MODE_TIMEOUT"
        );
        const stopModeObserved = true;
        const loadLightVisibleDuringStop = true;
        controls.reloadStop.click();
        await waitFor(
          () =>
            controls.reloadStop.title === "Reload" &&
            !gBrowser.selectedTab.hasAttribute("busy") &&
            loadLight()?.getAttribute("data-fennevia-progress-visible") ===
              "false",
          "FENNEVIA_FIREFOX_TEST_NAVIGATION_STOP_TIMEOUT"
        );
        const stopWorked = true;

        gBrowser.selectedBrowser.fixupAndLoadURIString(brokenUrl, {
          triggeringPrincipal:
            Services.scriptSecurityManager.getSystemPrincipal(),
        });
        await waitFor(
          () =>
            currentSpec() === brokenUrl &&
            !gBrowser.selectedTab.hasAttribute("busy") &&
            currentStatusUri() === brokenUrl,
          "FENNEVIA_FIREFOX_TEST_NAVIGATION_ERROR_PAGE_TIMEOUT"
        );
        const errorPageSettled = true;

        gBrowser.selectedBrowser.fixupAndLoadURIString(slowUrl, {
          triggeringPrincipal:
            Services.scriptSecurityManager.getSystemPrincipal(),
        });
        await waitFor(
          () => controls.reloadStop.title === "Stop",
          "FENNEVIA_FIREFOX_TEST_NAVIGATION_PENDING_CLOSE_START_TIMEOUT"
        );
        gBrowser.removeTab(openedTab, {
          animate: false,
          isUserTriggered: true,
        });
        await waitFor(
          () =>
            gBrowser.selectedTab === initialSelectedTab &&
            currentStatusUri() === gBrowser.currentURI.displaySpec &&
            controls.reloadStop.getAttribute("data-fennevia-loading") ===
              String(
                !document
                  .getElementById("Browser:Stop")
                  .hasAttribute("disabled")
              ),
          "FENNEVIA_FIREFOX_TEST_NAVIGATION_PENDING_CLOSE_HANDOFF_TIMEOUT"
        );
        const pendingCloseHandoffWorked = true;

        window.dispatchEvent(
          new KeyboardEvent("keydown", { bubbles: true, key: "Escape" })
        );
        await waitFor(
          () => root.getAttribute("data-fennevia-visible") === "false",
          "FENNEVIA_FIREFOX_TEST_NAVIGATION_ESCAPE_TIMEOUT"
        );

        return {
          alternatingNativeCustomWorked,
          backMatchesNative:
            controls.back.disabled ===
            document.getElementById("Browser:Back").hasAttribute("disabled"),
          customBackWorked,
          errorPageSettled,
          escapedHidden: root.getAttribute("data-fennevia-visible") === "false",
          forwardMatchesNative:
            controls.forward.disabled ===
            document
              .getElementById("Browser:Forward")
              .hasAttribute("disabled"),
          keyboardRevealFocused,
          loadLightVisibleDuringStop,
          newTabSelected,
          pendingCloseHandoffWorked,
          reloadStarted,
          reloadStopped,
          stopModeObserved,
          stopWorked,
          titleRenderedAsText,
        };
      })();
    `);
    return { ...result, requests: { ...requests } };
  } finally {
    for (const timer of responseTimers) {
      clearTimeout(timer);
    }
    responseTimers.clear();
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
}

function assertNavigationControls(result) {
  assert.equal(result.alternatingNativeCustomWorked, true);
  assert.equal(result.backMatchesNative, true);
  assert.equal(result.customBackWorked, true);
  assert.equal(result.errorPageSettled, true);
  assert.equal(result.escapedHidden, true);
  assert.equal(result.forwardMatchesNative, true);
  assert.equal(result.keyboardRevealFocused, true);
  assert.equal(result.loadLightVisibleDuringStop, true);
  assert.equal(result.newTabSelected, true);
  assert.equal(result.pendingCloseHandoffWorked, true);
  assert.equal(result.reloadStarted, true);
  assert.equal(result.reloadStopped, true);
  assert.equal(result.stopModeObserved, true);
  assert.equal(result.stopWorked, true);
  assert.equal(result.titleRenderedAsText, true);
  assert.ok(result.requests.first >= 1);
  assert.ok(result.requests.reload >= 2);
  assert.ok(result.requests.second >= 1);
  assert.ok(result.requests.slow >= 2);
  assert.ok(result.requests.broken >= 1);
}

async function exerciseAddressInput(client) {
  const requests = {
    custom: 0,
    draft: 0,
    final: 0,
    host: 0,
    native: 0,
    search: 0,
  };
  const server = createServer((request, response) => {
    const pathname = new URL(request.url ?? "/", "http://127.0.0.1").pathname;
    if (pathname === "/redirect") {
      response.writeHead(302, { Location: "/final" });
      response.end();
      return;
    }
    const key = pathname.slice(1);
    if (Object.hasOwn(requests, key)) {
      requests[key] += 1;
    }
    response.writeHead(200, {
      "Cache-Control": "no-store",
      "Content-Type": "text/html; charset=utf-8",
    });
    response.end(
      "<!doctype html><title>Address " +
        pathname.replaceAll("<", "&lt;") +
        "</title><main>address smoke</main>",
    );
  });

  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("FENNEVIA_FIREFOX_TEST_ADDRESS_SERVER_INVALID");
  }
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    const result = await client.execute(`
      return (async () => {
        const baseUrl = ${JSON.stringify(baseUrl)};
        const frame = document.getElementById("fennevia-shell-frame-host");
        const root = document.getElementById("fennevia-shell-left-root");
        const panel = root?.querySelector('[data-fennevia-edge-panel="left"]');
        const launcher = root?.querySelector("[data-fennevia-address-launcher]");
        const popupRoot = document.getElementById("fennevia-address-popup-root");
        const region = popupRoot;
        const input = popupRoot?.querySelector(
          "[data-fennevia-address-popup-input]"
        );
        const status = popupRoot?.querySelector(
          "[data-fennevia-address-popup-status]"
        );
        const nativeAccess = popupRoot?.querySelector(
          "[data-fennevia-native-urlbar-access]"
        );
        const urlbarCoverage = popupRoot?.querySelector(
          "[data-fennevia-urlbar-coverage]"
        );
        const nativeUrlbar = window.gURLBar;
        if (
          !frame ||
          !root ||
          !panel ||
          !launcher ||
          !region ||
          !input ||
          !status ||
          !nativeAccess ||
          !urlbarCoverage ||
          !nativeUrlbar
        ) {
          throw new Error("FENNEVIA_FIREFOX_TEST_ADDRESS_POPUP_MISSING");
        }

        const waitFor = async (predicate, code, timeoutMs = 10000) => {
          const deadline = Date.now() + timeoutMs;
          while (Date.now() < deadline) {
            if (predicate()) {
              return;
            }
            await new Promise(resolve => window.setTimeout(resolve, 20));
          }
          throw new Error(code);
        };
        const currentSpec = () => gBrowser.selectedBrowser.currentURI.spec;
        const loadNative = async url => {
          gBrowser.selectedBrowser.fixupAndLoadURIString(url, {
            triggeringPrincipal:
              Services.scriptSecurityManager.getSystemPrincipal(),
          });
          await waitFor(
            () => currentSpec() === url && !gBrowser.selectedTab.hasAttribute("busy"),
            "FENNEVIA_FIREFOX_TEST_ADDRESS_NATIVE_LOAD_TIMEOUT"
          );
        };
        const setDraft = value => {
          input.focus({ preventScroll: true });
          input.value = value;
          input.dispatchEvent(
            new InputEvent("input", {
              bubbles: true,
              composed: true,
              inputType: "insertText",
            })
          );
        };
        const submitDraft = () => {
          input.dispatchEvent(
            new KeyboardEvent("keydown", {
              bubbles: true,
              cancelable: true,
              key: "Enter",
            })
          );
        };
        const pressEscape = () => {
          window.dispatchEvent(
            new KeyboardEvent("keydown", {
              bubbles: true,
              cancelable: true,
              key: "Escape",
            })
          );
        };
        const dispatchOpenLocation = () => {
          const command = document.getElementById("Browser:OpenLocation");
          const commandEvent = new CustomEvent("command", {
            bubbles: true,
            cancelable: true,
          });
          Object.defineProperty(commandEvent, "sourceEvent", {
            value: { target: { id: "focusURLBar" } },
          });
          return command.dispatchEvent(commandEvent);
        };
        const popupPhase = () =>
          popupRoot.getAttribute("data-fennevia-address-popup-phase");
        const popupVisible = () =>
          !popupRoot.hidden && popupPhase() !== "hidden";
        const launcherLocation = () =>
          launcher.querySelector(".fennevia-address-launcher__location")
            ?.textContent?.trim() ?? "";
        const nativeNavBar = document.getElementById("nav-bar");

        await loadNative(baseUrl + "/draft");
        const documentRoot = document.documentElement;
        const hadHealthyMarker = documentRoot.hasAttribute(
          "data-fennevia-healthy"
        );
        const hadActiveMarker = documentRoot.hasAttribute(
          "data-fennevia-active"
        );
        documentRoot.removeAttribute("data-fennevia-healthy");
        documentRoot.removeAttribute("data-fennevia-active");
        gBrowser.selectedBrowser.focus();
        const nativeFallbackDispatchResult = dispatchOpenLocation();
        await waitFor(
          () => nativeUrlbar.focused,
          "FENNEVIA_FIREFOX_TEST_ADDRESS_NATIVE_FALLBACK_TIMEOUT"
        );
        const nativeFallbackWorked =
          nativeFallbackDispatchResult &&
          nativeUrlbar.focused &&
          getComputedStyle(nativeNavBar).visibility !== "collapse";
        nativeUrlbar.blur();
        nativeUrlbar.view.close();
        gBrowser.selectedBrowser.focus();
        if (hadHealthyMarker) {
          documentRoot.setAttribute("data-fennevia-healthy", "");
        }
        if (hadActiveMarker) {
          documentRoot.setAttribute("data-fennevia-active", "");
        }
        await waitFor(
          () => getComputedStyle(nativeNavBar).visibility === "collapse",
          "FENNEVIA_FIREFOX_TEST_ADDRESS_NATIVE_FALLBACK_RELEASE_TIMEOUT"
        );

        const customCommandDispatchResult = dispatchOpenLocation();
        await waitFor(
          () =>
            popupVisible() &&
            popupPhase() === "editing" &&
            document.activeElement === input,
          "FENNEVIA_FIREFOX_TEST_ADDRESS_CUSTOM_FOCUS_TIMEOUT"
        );
        const ctrlLFocusedAndSelected =
          !customCommandDispatchResult &&
          input.selectionStart === 0 &&
          input.selectionEnd === input.value.length &&
          !nativeUrlbar.focused &&
          root.getAttribute("data-fennevia-visible") === "false";

        const connectionBadgeByNativeState = {
          associated: "Linked",
          "cert-error-page": "Cert",
          chrome: "Firefox",
          extension: "Extension",
          file: "Local",
          "https-only-error-page": "HTTPS",
          "net-error-page": "Error",
          "not-secure": "HTTP",
          secure: "HTTPS",
          "secure-cert-user-overridden": "HTTPS",
          "secure-etsi": "HTTPS",
          "secure-ev": "HTTPS",
        };
        const nativeConnectionState =
          gIdentityHandler.getConnectionSecurityInformation();
        const expectedConnectionBadge =
          connectionBadgeByNativeState[nativeConnectionState] ?? "Info";
        const expectedProtectionBadge = !ContentBlockingAllowList.canHandle(
          gBrowser.selectedBrowser
        )
          ? "ETP —"
          : gProtectionsHandler.hasException
            ? "ETP off"
            : "ETP";
        const sideConnection = root.querySelector(
          "[data-fennevia-connection-status]"
        );
        const sideProtection = root.querySelector(
          "[data-fennevia-protection-status]"
        );
        const detailConnection = popupRoot.querySelector(
          "[data-fennevia-connection-detail] .fennevia-address-popup__detail-mark"
        );
        const detailProtection = popupRoot.querySelector(
          "[data-fennevia-protection-detail] .fennevia-address-popup__detail-mark"
        );
        const detailPermission = popupRoot.querySelector(
          "[data-fennevia-permission-detail] .fennevia-address-popup__detail-mark"
        );
        const firefoxSiteStatusMatched =
          sideConnection?.textContent?.trim() === expectedConnectionBadge &&
          detailConnection?.textContent?.trim() === expectedConnectionBadge &&
          sideProtection?.textContent?.trim() === expectedProtectionBadge &&
          detailProtection?.textContent?.trim() === expectedProtectionBadge &&
          Boolean(sideConnection?.getAttribute("aria-label")) &&
          Boolean(sideProtection?.getAttribute("aria-label"));

        const nativePermissionBox = document.getElementById(
          "identity-permission-box"
        );
        const sharingActive = [
          "webrtc-sharing-icon",
          "geo-sharing-icon",
          "xr-sharing-icon",
          "serial-sharing-icon",
        ].some(id => document.getElementById(id)?.hasAttribute("sharing"));
        const permissionAvailable =
          nativeUrlbar.getAttribute("pageproxystate") === "valid" ||
          nativeUrlbar.hasAttribute("persistsearchterms") ||
          sharingActive;
        const expectedPermissionBadge = !permissionAvailable
          ? "Permissions —"
          : sharingActive
            ? "In use"
            : "Permissions";
        const permissionStatusMatched =
          detailPermission?.textContent?.trim() === expectedPermissionBadge &&
          Boolean(nativePermissionBox);

        const nativeItemLabels = [
          ["contextual-feature-recommendation", "Firefox recommendation"],
          ["userContext-icons", "Container tab"],
          ["reader-mode-button", "Reader View"],
          ["picture-in-picture-button", "Picture-in-Picture"],
          ["taskbar-tabs-button", "Taskbar tab controls"],
          ["translations-button", "Translate page"],
          ["urlbar-zoom-button", "Reset page zoom"],
          ["split-view-button", "Split view"],
          ["star-button-box", "Bookmark page"],
        ];
        const renderedItemText = () =>
          [...urlbarCoverage.querySelectorAll(
            "[data-fennevia-urlbar-items] li"
          )].map(item => item.textContent?.trim() ?? "");
        const urlbarItemCoverageMatched = nativeItemLabels.every(
          ([id, label]) => {
            const element = document.getElementById(id);
            const ownerVisible =
              element &&
              !element.hidden &&
              element.getAttribute("hidden") !== "true" &&
              element.getAttribute("collapsed") !== "true";
            return renderedItemText().includes(label) === Boolean(ownerVisible);
          }
        );

        await FullZoom.enlarge();
        await waitFor(
          () => renderedItemText().includes("Reset page zoom"),
          "FENNEVIA_FIREFOX_TEST_URLBAR_ZOOM_APPEAR_TIMEOUT"
        );
        await FullZoom.reset();
        await waitFor(
          () => !renderedItemText().includes("Reset page zoom"),
          "FENNEVIA_FIREFOX_TEST_URLBAR_ZOOM_CLEAR_TIMEOUT"
        );
        const urlbarItemsUpdated = true;

        const nativeUiHiddenBeforeHandoff =
          !documentRoot.hasAttribute("data-fennevia-native-ui-revealed") &&
          getComputedStyle(nativeNavBar).visibility === "collapse";
        nativeAccess.click();
        await waitFor(
          () =>
            !popupVisible() &&
            popupPhase() === "hidden" &&
            nativeUrlbar.focused &&
            documentRoot.hasAttribute("data-fennevia-native-ui-revealed") &&
            getComputedStyle(nativeNavBar).visibility !== "collapse",
          "FENNEVIA_FIREFOX_TEST_NATIVE_URLBAR_ACCESS_TIMEOUT"
        );
        const nativeUrlbarAccessWorked =
          [
            "urlbar",
            "identity-box",
            "tracking-protection-icon-container",
            "identity-permission-box",
            "page-action-buttons",
            "downloads-button",
            "PanelUI-button",
          ].every(id => {
            const element = document.getElementById(id);
            return element && nativeNavBar.contains(element);
          }) && nativeNavBar.getBoundingClientRect().height > 0;
        nativeUrlbar.blur();
        nativeUrlbar.view.close();
        gBrowser.selectedBrowser.focus();
        await waitFor(
          () =>
            !documentRoot.hasAttribute("data-fennevia-native-ui-revealed") &&
            getComputedStyle(nativeNavBar).visibility === "collapse",
          "FENNEVIA_FIREFOX_TEST_NATIVE_URLBAR_RELEASE_TIMEOUT"
        );
        const nativeUrlbarHandoffReleased = true;
        dispatchOpenLocation();
        await waitFor(
          () => popupPhase() === "editing" && document.activeElement === input,
          "FENNEVIA_FIREFOX_TEST_URLBAR_COVERAGE_REFOCUS_TIMEOUT"
        );

        for (const key of ["ArrowUp", "ArrowLeft", "ArrowRight", "ArrowDown"]) {
          window.dispatchEvent(
            new KeyboardEvent("keydown", {
              altKey: true,
              bubbles: true,
              cancelable: true,
              ctrlKey: true,
              key,
              shiftKey: true,
            })
          );
        }
        const edgeTriggersSuppressed = ["top", "left", "right", "bottom"]
          .every(edge =>
            document
              .getElementById("fennevia-shell-" + edge + "-root")
              ?.getAttribute("data-fennevia-visible") === "false"
          );

        pressEscape();
        await waitFor(
          () => !popupVisible() && popupPhase() === "hidden",
          "FENNEVIA_FIREFOX_TEST_ADDRESS_CUSTOM_CLOSE_TIMEOUT"
        );

        nativeUrlbar.value = baseUrl + "/native";
        nativeUrlbar.handleCommand();
        await waitFor(
          () =>
            currentSpec() === baseUrl + "/native" &&
            !gBrowser.selectedTab.hasAttribute("busy") &&
            launcherLocation() === nativeUrlbar.value,
          "FENNEVIA_FIREFOX_TEST_ADDRESS_NATIVE_SYNC_TIMEOUT"
        );
        const nativeSubmissionSynchronized = true;

        dispatchOpenLocation();
        await waitFor(() => popupPhase() === "editing" && document.activeElement === input,
          "FENNEVIA_FIREFOX_TEST_ADDRESS_CUSTOM_REFOCUS_TIMEOUT");
        setDraft(baseUrl + "/custom");
        submitDraft();
        await waitFor(
          () =>
            currentSpec() === baseUrl + "/custom" &&
            !gBrowser.selectedTab.hasAttribute("busy") &&
            !popupVisible() &&
            launcherLocation() === nativeUrlbar.value,
          "FENNEVIA_FIREFOX_TEST_ADDRESS_CUSTOM_SUBMIT_TIMEOUT"
        );
        const customUrlWorked = true;

        dispatchOpenLocation();
        await waitFor(() => popupPhase() === "editing" && document.activeElement === input,
          "FENNEVIA_FIREFOX_TEST_ADDRESS_HOST_REFOCUS_TIMEOUT");
        setDraft("127.0.0.1:${address.port}/host");
        submitDraft();
        await waitFor(
          () =>
            new URL(currentSpec()).pathname === "/host" &&
            !gBrowser.selectedTab.hasAttribute("busy") &&
            !popupVisible(),
          "FENNEVIA_FIREFOX_TEST_ADDRESS_HOST_FIXUP_TIMEOUT"
        );
        const hostLikeWorked = true;

        const beforeInvalidSpec = currentSpec();
        dispatchOpenLocation();
        await waitFor(() => popupPhase() === "editing" && document.activeElement === input,
          "FENNEVIA_FIREFOX_TEST_ADDRESS_INVALID_REFOCUS_TIMEOUT");
        setDraft("   ");
        submitDraft();
        await waitFor(
          () =>
            popupPhase() === "invalid" &&
            status.textContent.includes("Enter an address"),
          "FENNEVIA_FIREFOX_TEST_ADDRESS_EMPTY_REJECTION_TIMEOUT"
        );
        const emptyRejected = currentSpec() === beforeInvalidSpec;
        setDraft("javascript:document.documentElement.dataset.unsafe='true'");
        submitDraft();
        await waitFor(
          () => status.textContent.includes("Executable address schemes"),
          "FENNEVIA_FIREFOX_TEST_ADDRESS_SCHEME_REJECTION_TIMEOUT"
        );
        const unsafeSchemeRejected =
          currentSpec() === beforeInvalidSpec &&
          !gBrowser.selectedBrowser.contentPrincipal?.isSystemPrincipal;
        setDraft("x".repeat(4097));
        await waitFor(
          () =>
            popupPhase() === "invalid" &&
            input.value.length === 4096 &&
            status.textContent.includes("4,096"),
          "FENNEVIA_FIREFOX_TEST_ADDRESS_LONG_REJECTION_TIMEOUT"
        );
        const longInputBounded = input.value.length === 4096;
        pressEscape();
        await waitFor(
          () => !popupVisible() && popupPhase() === "hidden",
          "FENNEVIA_FIREFOX_TEST_ADDRESS_INVALID_ESCAPE_TIMEOUT"
        );

        const searchTerm = "fennevia issue thirteen smoke query";
        let searchService;
        try {
          ({ SearchService: searchService } = ChromeUtils.importESModule(
            "moz-src:///toolkit/components/search/SearchService.sys.mjs"
          ));
        } catch {
          throw new Error(
            "FENNEVIA_FIREFOX_TEST_ADDRESS_SEARCH_SERVICE_IMPORT_FAILED"
          );
        }
        let previousDefaultEngine;
        try {
          previousDefaultEngine = await searchService.getDefault();
        } catch {
          throw new Error(
            "FENNEVIA_FIREFOX_TEST_ADDRESS_SEARCH_DEFAULT_READ_FAILED"
          );
        }
        let localSearchEngine;
        try {
          localSearchEngine = await searchService.addUserEngine({
            name: "Fennevia local smoke " + Date.now(),
            url: baseUrl + "/search?q={searchTerms}",
          });
        } catch {
          throw new Error(
            "FENNEVIA_FIREFOX_TEST_ADDRESS_SEARCH_ENGINE_ADD_FAILED"
          );
        }
        let searchObserved = false;
        try {
          try {
            await searchService.setDefault(
              localSearchEngine,
              searchService.CHANGE_REASON.USER
            );
          } catch {
            throw new Error(
              "FENNEVIA_FIREFOX_TEST_ADDRESS_SEARCH_DEFAULT_SET_FAILED"
            );
          }
          dispatchOpenLocation();
          await waitFor(() => popupPhase() === "editing" && document.activeElement === input,
            "FENNEVIA_FIREFOX_TEST_ADDRESS_SEARCH_REFOCUS_TIMEOUT");
          setDraft(searchTerm);
          submitDraft();
          await waitFor(
            () => {
              if (
                !currentSpec().startsWith(baseUrl + "/search?") ||
                gBrowser.selectedTab.hasAttribute("busy")
              ) {
                return false;
              }
              const searchUrl = new URL(currentSpec());
              searchObserved = searchUrl.searchParams.get("q") === searchTerm;
              return searchObserved && !popupVisible();
            },
            "FENNEVIA_FIREFOX_TEST_ADDRESS_SEARCH_TIMEOUT"
          );
        } finally {
          try {
            await searchService.setDefault(
              previousDefaultEngine,
              searchService.CHANGE_REASON.USER
            );
          } catch {
            throw new Error(
              "FENNEVIA_FIREFOX_TEST_ADDRESS_SEARCH_DEFAULT_RESTORE_FAILED"
            );
          }
          try {
            await searchService.removeEngine(
              localSearchEngine,
              searchService.CHANGE_REASON.USER
            );
          } catch {
            throw new Error(
              "FENNEVIA_FIREFOX_TEST_ADDRESS_SEARCH_ENGINE_REMOVE_FAILED"
            );
          }
          BrowserCommands.stop();
        }

        await loadNative(baseUrl + "/draft");
        dispatchOpenLocation();
        await waitFor(() => popupPhase() === "editing" && document.activeElement === input,
          "FENNEVIA_FIREFOX_TEST_ADDRESS_DRAFT_REFOCUS_TIMEOUT");
        const independentDraft = "unsubmitted address draft";
        setDraft(independentDraft);
        gBrowser.selectedBrowser.fixupAndLoadURIString(baseUrl + "/redirect", {
          triggeringPrincipal:
            Services.scriptSecurityManager.getSystemPrincipal(),
        });
        await waitFor(
          () =>
            currentSpec() === baseUrl + "/final" &&
            !gBrowser.selectedTab.hasAttribute("busy") &&
            input.value === independentDraft,
          "FENNEVIA_FIREFOX_TEST_ADDRESS_DRAFT_REDIRECT_TIMEOUT"
        );
        const draftSurvivedRedirect = true;

        const editedTab = gBrowser.selectedTab;
        BrowserCommands.openTab();
        await waitFor(
          () =>
            gBrowser.selectedTab !== editedTab &&
            !popupVisible() &&
            popupPhase() === "hidden" &&
            input.value === "",
          "FENNEVIA_FIREFOX_TEST_ADDRESS_TAB_SWITCH_CLOSE_TIMEOUT"
        );
        const draftDiscardedOnTabSwitch = true;
        const switchedTab = gBrowser.selectedTab;
        gBrowser.removeTab(switchedTab, { animate: false, isUserTriggered: true });
        await waitFor(
          () => gBrowser.selectedTab === editedTab,
          "FENNEVIA_FIREFOX_TEST_ADDRESS_TAB_CLOSE_TIMEOUT"
        );

        window.dispatchEvent(
          new KeyboardEvent("keydown", {
            altKey: true,
            bubbles: true,
            cancelable: true,
            ctrlKey: true,
            key: "ArrowLeft",
            shiftKey: true,
          })
        );
        await waitFor(
          () =>
            root.getAttribute("data-fennevia-visible") === "true" &&
            document.activeElement === launcher,
          "FENNEVIA_FIREFOX_TEST_ADDRESS_LAUNCHER_REVEAL_TIMEOUT"
        );
        launcher.click();
        await waitFor(
          () => popupPhase() === "editing" && document.activeElement === input,
          "FENNEVIA_FIREFOX_TEST_ADDRESS_LAUNCHER_OPEN_TIMEOUT"
        );
        pressEscape();
        await waitFor(
          () =>
            !popupVisible() &&
            popupPhase() === "hidden" &&
            root.getAttribute("data-fennevia-visible") === "true" &&
            document.activeElement === launcher,
          "FENNEVIA_FIREFOX_TEST_ADDRESS_LAUNCHER_CANCEL_TIMEOUT"
        );
        const launcherCancelRestored = true;
        pressEscape();
        await waitFor(
          () => root.getAttribute("data-fennevia-visible") === "false",
          "FENNEVIA_FIREFOX_TEST_ADDRESS_SECOND_ESCAPE_TIMEOUT"
        );

        return {
          ctrlLFocusedAndSelected,
          customUrlWorked,
          draftDiscardedOnTabSwitch,
          draftSurvivedRedirect,
          edgeTriggersSuppressed,
          emptyRejected,
          firefoxSiteStatusMatched,
          hostLikeWorked,
          launcherCancelRestored,
          longInputBounded,
          nativeFallbackWorked,
          nativeUiHiddenBeforeHandoff,
          nativeUrlbarAccessWorked,
          nativeUrlbarHandoffReleased,
          nativeSubmissionSynchronized,
          permissionStatusMatched,
          searchObserved,
          escapeDismissed:
            root.getAttribute("data-fennevia-visible") === "false",
          unsafeSchemeRejected,
          urlbarItemCoverageMatched,
          urlbarItemsUpdated,
        };
      })();
    `);
    return { ...result, requests: { ...requests } };
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
}

function assertAddressInput(result) {
  for (const key of [
    "ctrlLFocusedAndSelected",
    "customUrlWorked",
    "draftDiscardedOnTabSwitch",
    "draftSurvivedRedirect",
    "edgeTriggersSuppressed",
    "emptyRejected",
    "firefoxSiteStatusMatched",
    "hostLikeWorked",
    "launcherCancelRestored",
    "longInputBounded",
    "nativeFallbackWorked",
    "nativeUiHiddenBeforeHandoff",
    "nativeUrlbarAccessWorked",
    "nativeUrlbarHandoffReleased",
    "nativeSubmissionSynchronized",
    "permissionStatusMatched",
    "searchObserved",
    "escapeDismissed",
    "unsafeSchemeRejected",
    "urlbarItemCoverageMatched",
    "urlbarItemsUpdated",
  ]) {
    assert.equal(result[key], true, key);
  }
  assert.ok(result.requests.custom >= 1);
  assert.ok(result.requests.draft >= 2);
  assert.ok(result.requests.final >= 1);
  assert.ok(result.requests.host >= 1);
  assert.ok(result.requests.native >= 1);
  assert.ok(result.requests.search >= 1);
}

async function exerciseUrlbarCoverageMatrix(client) {
  const server = createServer((request, response) => {
    const pathname = new URL(request.url ?? "/", "http://127.0.0.1").pathname;
    if (pathname === "/network-error") {
      request.socket.destroy();
      return;
    }
    response.writeHead(200, {
      "Cache-Control": "no-store",
      "Content-Type": "text/html; charset=utf-8",
    });
    response.end(
      "<!doctype html><title>Urlbar coverage matrix</title><main>local fixture</main>",
    );
  });

  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("FENNEVIA_FIREFOX_TEST_URLBAR_MATRIX_SERVER_INVALID");
  }
  const baseUrl = `http://fennevia.test:${address.port}`;

  try {
    return await client.execute(
      `
      return (async () => {
        const baseUrl = ${JSON.stringify(baseUrl)};
        const httpsUrl = "https://example.com/";
        const root = document.getElementById("fennevia-shell-left-root");
        const popupRoot = document.getElementById("fennevia-address-popup-root");
        const nativeUrlbar = window.gURLBar;
        const sideConnection = root?.querySelector(
          "[data-fennevia-connection-status]"
        );
        const sideProtection = root?.querySelector(
          "[data-fennevia-protection-status]"
        );
        const detailConnection = popupRoot?.querySelector(
          "[data-fennevia-connection-detail] .fennevia-address-popup__detail-mark"
        );
        const detailProtection = popupRoot?.querySelector(
          "[data-fennevia-protection-detail] .fennevia-address-popup__detail-mark"
        );
        if (
          !root ||
          !popupRoot ||
          !nativeUrlbar ||
          !sideConnection ||
          !sideProtection ||
          !detailConnection ||
          !detailProtection
        ) {
          throw new Error("FENNEVIA_FIREFOX_TEST_URLBAR_MATRIX_UI_MISSING");
        }

        const waitFor = async (predicate, code, timeoutMs = 20000) => {
          const deadline = Date.now() + timeoutMs;
          while (Date.now() < deadline) {
            if (predicate()) {
              return;
            }
            await new Promise(resolve => window.setTimeout(resolve, 20));
          }
          throw new Error(code);
        };
        const currentSpec = () => gBrowser.selectedBrowser.currentURI.spec;
        const load = async (url, timeoutMs = 20000) => {
          gBrowser.selectedBrowser.fixupAndLoadURIString(url, {
            triggeringPrincipal:
              Services.scriptSecurityManager.getSystemPrincipal(),
          });
          await waitFor(
            () =>
              currentSpec() === url &&
              !gBrowser.selectedTab.hasAttribute("busy"),
            "FENNEVIA_FIREFOX_TEST_URLBAR_MATRIX_LOAD_TIMEOUT",
            timeoutMs
          );
        };
        const popupPhase = () =>
          popupRoot.getAttribute("data-fennevia-address-popup-phase");
        const openPopup = async () => {
          if (popupPhase() === "editing") {
            return;
          }
          const command = document.getElementById("Browser:OpenLocation");
          const event = new CustomEvent("command", {
            bubbles: true,
            cancelable: true,
          });
          Object.defineProperty(event, "sourceEvent", {
            value: { target: { id: "focusURLBar" } },
          });
          command.dispatchEvent(event);
          await waitFor(
            () => popupPhase() === "editing",
            "FENNEVIA_FIREFOX_TEST_URLBAR_MATRIX_POPUP_OPEN_TIMEOUT"
          );
        };
        const closePopup = async () => {
          if (popupPhase() === "hidden") {
            return;
          }
          window.dispatchEvent(
            new KeyboardEvent("keydown", {
              bubbles: true,
              cancelable: true,
              key: "Escape",
            })
          );
          await waitFor(
            () => popupPhase() === "hidden",
            "FENNEVIA_FIREFOX_TEST_URLBAR_MATRIX_POPUP_CLOSE_TIMEOUT"
          );
        };
        const connectionMatches = badge =>
          sideConnection.textContent?.trim() === badge &&
          detailConnection.textContent?.trim() === badge;
        const protectionMatches = badge =>
          sideProtection.textContent?.trim() === badge &&
          detailProtection.textContent?.trim() === badge;
        const renderedPermissions = () =>
          [...popupRoot.querySelectorAll(
            "[data-fennevia-permission-indicators] li"
          )].map(item => item.textContent?.trim() ?? "");

        const dnsPrefName = "network.dns.localDomains";
        const hadDnsPref = Services.prefs.prefHasUserValue(dnsPrefName);
        const originalDnsPref = Services.prefs.getStringPref(dnsPrefName, "");
        Services.prefs.setStringPref(dnsPrefName, "fennevia.test");
        let permissionSet = false;
        let protectionExceptionSet = false;
        try {
          await load(baseUrl + "/http");
          await openPopup();
          await waitFor(
            () =>
              gIdentityHandler.getConnectionSecurityInformation() ===
                "not-secure" && connectionMatches("HTTP"),
            "FENNEVIA_FIREFOX_TEST_URLBAR_HTTP_STATUS_TIMEOUT"
          );
          const httpStateMatched = true;

          const browser = gBrowser.selectedBrowser;
          SitePermissions.setForPrincipal(
            browser.contentPrincipal,
            "camera",
            SitePermissions.BLOCK,
            SitePermissions.SCOPE_TEMPORARY,
            browser
          );
          permissionSet = true;
          gPermissionPanel.refreshPermissionIcons();
          await waitFor(
            () =>
              document
                .getElementById("identity-permission-box")
                ?.hasAttribute("hasPermissions") &&
              document
                .querySelector(
                  '#blocked-permissions-container [data-permission-id="camera"]'
                )
                ?.hasAttribute("showing") &&
              renderedPermissions().includes("Camera blocked"),
            "FENNEVIA_FIREFOX_TEST_URLBAR_PERMISSION_STATUS_TIMEOUT"
          );
          const permissionStateMatched = true;
          SitePermissions.removeFromPrincipal(
            browser.contentPrincipal,
            "camera",
            browser
          );
          permissionSet = false;
          gPermissionPanel.refreshPermissionIcons();
          await waitFor(
            () => !renderedPermissions().includes("Camera blocked"),
            "FENNEVIA_FIREFOX_TEST_URLBAR_PERMISSION_CLEAR_TIMEOUT"
          );
          await closePopup();

          await load(httpsUrl, 30000);
          await openPopup();
          await waitFor(
            () =>
              [
                "secure",
                "secure-cert-user-overridden",
                "secure-etsi",
                "secure-ev",
              ].includes(
                gIdentityHandler.getConnectionSecurityInformation()
              ) && connectionMatches("HTTPS"),
            "FENNEVIA_FIREFOX_TEST_URLBAR_HTTPS_STATUS_TIMEOUT",
            30000
          );
          const httpsStateMatched = true;
          await closePopup();

          ContentBlockingAllowList.add(gBrowser.selectedBrowser);
          protectionExceptionSet = true;
          BrowserCommands.reload();
          await waitFor(
            () =>
              !gBrowser.selectedTab.hasAttribute("busy") &&
              gProtectionsHandler.hasException === true,
            "FENNEVIA_FIREFOX_TEST_URLBAR_PROTECTION_EXCEPTION_LOAD_TIMEOUT",
            30000
          );
          await openPopup();
          await waitFor(
            () => protectionMatches("ETP off"),
            "FENNEVIA_FIREFOX_TEST_URLBAR_PROTECTION_EXCEPTION_TIMEOUT"
          );
          const protectionExceptionMatched = true;
          await closePopup();
          ContentBlockingAllowList.remove(gBrowser.selectedBrowser);
          protectionExceptionSet = false;
          BrowserCommands.reload();
          await waitFor(
            () =>
              !gBrowser.selectedTab.hasAttribute("busy") &&
              gProtectionsHandler.hasException === false,
            "FENNEVIA_FIREFOX_TEST_URLBAR_PROTECTION_RESTORE_LOAD_TIMEOUT",
            30000
          );
          await openPopup();
          await waitFor(
            () => protectionMatches("ETP"),
            "FENNEVIA_FIREFOX_TEST_URLBAR_PROTECTION_RESTORE_TIMEOUT"
          );
          const protectionStateMatched = true;
          await closePopup();

          await load("about:preferences");
          await openPopup();
          await waitFor(
            () =>
              gIdentityHandler.getConnectionSecurityInformation() ===
                "chrome" && connectionMatches("Firefox"),
            "FENNEVIA_FIREFOX_TEST_URLBAR_INTERNAL_STATUS_TIMEOUT"
          );
          const internalStateMatched = true;
          await closePopup();

          await load(baseUrl + "/network-error");
          await openPopup();
          await waitFor(
            () =>
              gIdentityHandler.getConnectionSecurityInformation() ===
                "net-error-page" && connectionMatches("Error"),
            "FENNEVIA_FIREFOX_TEST_URLBAR_ERROR_STATUS_TIMEOUT"
          );
          const errorStateMatched = true;
          await closePopup();

          return {
            errorStateMatched,
            httpStateMatched,
            httpsStateMatched,
            internalStateMatched,
            permissionStateMatched,
            protectionExceptionMatched,
            protectionStateMatched,
          };
        } finally {
          if (permissionSet) {
            SitePermissions.removeFromPrincipal(
              gBrowser.selectedBrowser.contentPrincipal,
              "camera",
              gBrowser.selectedBrowser
            );
            gPermissionPanel.refreshPermissionIcons();
          }
          if (protectionExceptionSet) {
            ContentBlockingAllowList.remove(gBrowser.selectedBrowser);
            BrowserCommands.reload();
          }
          if (hadDnsPref) {
            Services.prefs.setStringPref(dnsPrefName, originalDnsPref);
          } else {
            Services.prefs.clearUserPref(dnsPrefName);
          }
          await closePopup();
        }
      })();
    `,
      URLBAR_COVERAGE_MATRIX_TIMEOUT_MS,
    );
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
}

function assertUrlbarCoverageMatrix(result) {
  for (const key of [
    "errorStateMatched",
    "httpStateMatched",
    "httpsStateMatched",
    "internalStateMatched",
    "permissionStateMatched",
    "protectionExceptionMatched",
    "protectionStateMatched",
  ]) {
    assert.equal(result[key], true, key);
  }
}

async function exerciseTabStripMvp(client) {
  const pageTitle =
    '<img data-fennevia-injected="true"> RTL \u202e abc \u202c العربية ' +
    "x".repeat(180);
  const escapedPageTitle = pageTitle
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
  const responseTimers = new Set();
  const server = createServer((request, response) => {
    const pathname = new URL(request.url ?? "/", "http://127.0.0.1").pathname;
    if (pathname !== "/tab-loading") {
      response.writeHead(404, {
        "Cache-Control": "no-store",
        "Content-Type": "text/plain; charset=utf-8",
      });
      response.end("not found");
      return;
    }
    response.writeHead(200, {
      "Cache-Control": "no-store",
      "Content-Type": "text/html; charset=utf-8",
    });
    response.write(
      `<!doctype html><title>${escapedPageTitle}</title><main>loading`,
    );
    const timer = setTimeout(() => {
      responseTimers.delete(timer);
      if (!response.writableEnded) {
        response.end(" complete</main>");
      }
    }, 30_000);
    responseTimers.add(timer);
    response.once("close", () => {
      clearTimeout(timer);
      responseTimers.delete(timer);
    });
  });

  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("FENNEVIA_FIREFOX_TEST_TAB_STRIP_SERVER_INVALID");
  }
  const tabLoadingUrl = `http://127.0.0.1:${address.port}/tab-loading`;

  try {
    return await client.execute(`
    return (async () => {
      const pageTitle = ${JSON.stringify(pageTitle)};
      const tabLoadingUrl = ${JSON.stringify(tabLoadingUrl)};
      const root = document.getElementById("fennevia-shell-left-root");
      const newTab = root?.querySelector(
        '[data-fennevia-action="new-tab"]'
      );
      const scroll = root?.querySelector(".fennevia-tab-strip__list");
      if (!root || !newTab || !scroll) {
        throw new Error("FENNEVIA_FIREFOX_TEST_TAB_STRIP_MISSING");
      }

      const customTabs = () => [
        ...root.querySelectorAll('button[role="tab"][data-fennevia-tab]'),
      ];
      const customItems = () => [
        ...root.querySelectorAll(".fennevia-tab-strip__item"),
      ];
      const waitFor = async (predicate, code) => {
        const deadline = Date.now() + 5000;
        while (Date.now() < deadline) {
          if (predicate()) {
            return;
          }
          await new Promise(resolve => window.setTimeout(resolve, 20));
        }
        throw new Error(code);
      };
      const waitForCount = count =>
        waitFor(
          () =>
            gBrowser.openTabs.length === count &&
            customTabs().length === count,
          "FENNEVIA_FIREFOX_TEST_TAB_STRIP_COUNT_TIMEOUT"
        );
      const dispatchKey = (target, key) => {
        target.dispatchEvent(
          new KeyboardEvent("keydown", {
            bubbles: true,
            cancelable: true,
            key,
          })
        );
      };

      window.dispatchEvent(
        new KeyboardEvent("keydown", {
          altKey: true,
          bubbles: true,
          cancelable: true,
          ctrlKey: true,
          key: "ArrowLeft",
          shiftKey: true,
        })
      );
      await waitFor(
        () => root.getAttribute("data-fennevia-visible") === "true",
        "FENNEVIA_FIREFOX_TEST_TAB_STRIP_REVEAL_TIMEOUT"
      );

      const originalNativeTab = gBrowser.selectedTab;
      for (const staleTab of [...gBrowser.openTabs]) {
        if (staleTab !== originalNativeTab) {
          gBrowser.removeTab(staleTab, {
            animate: false,
            isUserTriggered: true,
          });
        }
      }
      await waitForCount(1);
      const initialCount = gBrowser.openTabs.length;
      for (let index = 0; index < 14; index += 1) {
        newTab.click();
      }
      await waitForCount(initialCount + 14);
      await waitFor(
        () => gBrowser.openTabs.every(tab => !tab.hasAttribute("busy")),
        "FENNEVIA_FIREFOX_TEST_TAB_STRIP_NEW_TABS_SETTLE_TIMEOUT"
      );
      const manyTabsOverflow = scroll.scrollHeight > scroll.clientHeight;
      const synchronizedAfterBurst =
        customTabs().length === gBrowser.openTabs.length &&
        customTabs().filter(
          tab => tab.getAttribute("aria-selected") === "true"
        ).length === 1;

      const testNativeTab = gBrowser.openTabs.find(
        tab => tab !== originalNativeTab
      );
      const testNativeBrowser = testNativeTab.linkedBrowser;
      const itemForNativeTab = nativeTab =>
        customItems().at(gBrowser.openTabs.indexOf(nativeTab));
      const selectedBeforeBackgroundAction = gBrowser.selectedTab;
      testNativeBrowser.fixupAndLoadURIString(tabLoadingUrl, {
        triggeringPrincipal:
          Services.scriptSecurityManager.getSystemPrincipal(),
      });
      await waitFor(
        () =>
          testNativeTab.hasAttribute("busy") &&
          testNativeTab.getAttribute("label")?.trim() === pageTitle.trim(),
        "FENNEVIA_FIREFOX_TEST_TAB_STRIP_NATIVE_LOADING_TIMEOUT"
      );
      testNativeTab.setAttribute("image", "data:image/png;base64,AAAA");
      testNativeTab.dispatchEvent(
        new CustomEvent("TabAttrModified", {
          bubbles: true,
          detail: { changed: ["busy", "image", "label"] },
        })
      );
      try {
        await waitFor(
          () =>
            itemForNativeTab(testNativeTab)?.getAttribute(
              "data-fennevia-loading"
            ) === "true" &&
            itemForNativeTab(testNativeTab)
              ?.querySelector(".fennevia-tab-strip__title")
              ?.textContent?.trim() === pageTitle.trim(),
          "FENNEVIA_FIREFOX_TEST_TAB_STRIP_STATE_TIMEOUT"
        );
      } catch {
        const diagnosticItem = itemForNativeTab(testNativeTab);
        if (!diagnosticItem) {
          throw new Error(
            "FENNEVIA_FIREFOX_TEST_TAB_STRIP_STATE_ITEM_MISSING"
          );
        }
        if (
          diagnosticItem.getAttribute("data-fennevia-loading") !== "true"
        ) {
          throw new Error(
            "FENNEVIA_FIREFOX_TEST_TAB_STRIP_STATE_LOADING_MISMATCH"
          );
        }
        throw new Error(
          "FENNEVIA_FIREFOX_TEST_TAB_STRIP_STATE_TITLE_MISMATCH"
        );
      }
      const updatedItem = itemForNativeTab(testNativeTab);
      const loadingStateVisible = Boolean(
        updatedItem?.querySelector(".fennevia-tab-strip__loading")
      );
      const titleInjectionSafe =
        !root.querySelector("[data-fennevia-injected]") &&
        !updatedItem?.getAttribute("style");
      await waitFor(
        () => {
          const image = updatedItem?.querySelector(
            ".fennevia-tab-strip__favicon"
          );
          return Boolean(image && (image.hidden || !image.hasAttribute("src")));
        },
        "FENNEVIA_FIREFOX_TEST_TAB_STRIP_FAVICON_TIMEOUT"
      );
      const failedFaviconFallback = Boolean(
        updatedItem?.querySelector(".fennevia-tab-strip__fallback") &&
          updatedItem
            ?.querySelector(".fennevia-tab-strip__favicon")
            ?.hidden
      );
      testNativeBrowser.stop();
      await waitFor(
        () =>
          !testNativeTab.hasAttribute("busy") &&
          itemForNativeTab(testNativeTab)?.getAttribute(
            "data-fennevia-loading"
          ) === "false",
        "FENNEVIA_FIREFOX_TEST_TAB_STRIP_LOADING_CLEAR_TIMEOUT"
      );
      const loadingStateCleared = true;

      updatedItem
        ?.querySelector('[data-fennevia-action="pin-tab"]')
        ?.click();
      await waitFor(
        () =>
          testNativeTab.hasAttribute("pinned") &&
          itemForNativeTab(testNativeTab)?.getAttribute(
            "data-fennevia-pinned"
          ) === "true",
        "FENNEVIA_FIREFOX_TEST_TAB_STRIP_PIN_TIMEOUT"
      );
      const pinnedItem = itemForNativeTab(testNativeTab);
      const regularItem = customItems().find(
        item => item.getAttribute("data-fennevia-pinned") === "false"
      );
      const pinnedLayoutStable =
        Boolean(pinnedItem && regularItem) &&
        Math.abs(
          pinnedItem.getBoundingClientRect().width -
            regularItem.getBoundingClientRect().width
        ) < 2 &&
        Math.abs(
          pinnedItem.getBoundingClientRect().height -
            regularItem.getBoundingClientRect().height
        ) < 2;
      const pinDidNotSelect =
        gBrowser.selectedTab === selectedBeforeBackgroundAction;

      pinnedItem
        ?.querySelector('[data-fennevia-action="unpin-tab"]')
        ?.click();
      await waitFor(
        () =>
          !testNativeTab.hasAttribute("pinned") &&
          itemForNativeTab(testNativeTab)?.getAttribute(
            "data-fennevia-pinned"
          ) === "false",
        "FENNEVIA_FIREFOX_TEST_TAB_STRIP_UNPIN_TIMEOUT"
      );
      const unpinDidNotSelect =
        gBrowser.selectedTab === selectedBeforeBackgroundAction;

      const selectedButton = root.querySelector(
        'button[role="tab"][aria-selected="true"]'
      );
      dispatchKey(selectedButton, "Home");
      await waitFor(
        () =>
          gBrowser.selectedTab === gBrowser.openTabs.at(0) &&
          document.activeElement === customTabs().at(0),
        "FENNEVIA_FIREFOX_TEST_TAB_STRIP_HOME_TIMEOUT"
      );
      const homeSelectedFirst = true;

      const wrappedNativeTab = gBrowser.openTabs.at(-1);
      dispatchKey(customTabs().at(0), "ArrowUp");
      await waitFor(
        () => gBrowser.selectedTab === wrappedNativeTab,
        "FENNEVIA_FIREFOX_TEST_TAB_STRIP_WRAP_SELECTION_TIMEOUT"
      );
      await waitFor(
        () => {
          const wrappedIndex = gBrowser.openTabs.indexOf(wrappedNativeTab);
          return (
            wrappedIndex >= 0 &&
            document.activeElement === customTabs().at(wrappedIndex)
          );
        },
        "FENNEVIA_FIREFOX_TEST_TAB_STRIP_WRAP_FOCUS_TIMEOUT"
      );
      const arrowWrapped = true;

      const beforeSelectedClose = gBrowser.openTabs.length;
      dispatchKey(document.activeElement, "Delete");
      await waitForCount(beforeSelectedClose - 1);
      const selectedCloseRestoredFocus =
        document.activeElement?.matches?.(
          'button[role="tab"][data-fennevia-tab]'
        ) &&
        document.activeElement.getAttribute("aria-selected") === "true" &&
        document.activeElement.tabIndex === 0;

      const selectedBeforeBackgroundClose = gBrowser.selectedTab;
      itemForNativeTab(testNativeTab)
        ?.querySelector('[data-fennevia-action="close-tab"]')
        ?.click();
      await waitForCount(beforeSelectedClose - 2);
      const backgroundCloseDidNotSelect =
        gBrowser.selectedTab === selectedBeforeBackgroundClose;

      const originalIndex = gBrowser.openTabs.indexOf(originalNativeTab);
      customTabs().at(originalIndex)?.click();
      await waitFor(
        () => gBrowser.selectedTab === originalNativeTab,
        "FENNEVIA_FIREFOX_TEST_TAB_STRIP_ORIGINAL_SELECT_TIMEOUT"
      );
      while (gBrowser.openTabs.length > 1) {
        const count = gBrowser.openTabs.length;
        const disposableIndex = gBrowser.openTabs.findIndex(
          tab => tab !== originalNativeTab
        );
        customItems()
          .at(disposableIndex)
          ?.querySelector('[data-fennevia-action="close-tab"]')
          ?.click();
        await waitForCount(count - 1);
      }
      const rapidCleanupComplete =
        customTabs().length === 1 &&
        gBrowser.openTabs.length === 1 &&
        gBrowser.selectedTab === originalNativeTab;
      await waitFor(
        () =>
          document.querySelectorAll("tabbrowser-tab[closing]").length === 0,
        "FENNEVIA_FIREFOX_TEST_TAB_STRIP_BURST_SETTLE_TIMEOUT"
      );

      newTab.click();
      await waitForCount(2);
      customItems()
        .find(item => item.getAttribute("data-fennevia-selected") === "true")
        ?.querySelector('[data-fennevia-action="close-tab"]')
        ?.click();
      await waitForCount(1);
      await new Promise(resolve => window.setTimeout(resolve, 500));
      const closeButtonRestoredFocus =
        document.activeElement === customTabs().at(0) &&
        customTabs().at(0)?.tabIndex === 0;
      const closeFocusDiagnostics = {
        activeDataTab: document.activeElement?.hasAttribute?.(
          "data-fennevia-tab"
        ) ?? false,
        activeId: document.activeElement?.id ?? null,
        activeLocalName: document.activeElement?.localName ?? null,
        activeTabIndex: document.activeElement?.tabIndex ?? null,
        firstConnected: customTabs().at(0)?.isConnected ?? false,
        firstSelected:
          customTabs().at(0)?.getAttribute("aria-selected") ?? null,
        firstTabIndex: customTabs().at(0)?.tabIndex ?? null,
        rootContainsActive: root.contains(document.activeElement),
        surfacePhase: root.getAttribute("data-fennevia-phase"),
      };
      await waitFor(
        () =>
          document.querySelectorAll("tabbrowser-tab[closing]").length === 0,
        "FENNEVIA_FIREFOX_TEST_TAB_STRIP_CLOSE_SETTLE_TIMEOUT"
      );
      window.dispatchEvent(
        new KeyboardEvent("keydown", {
          bubbles: true,
          cancelable: true,
          key: "Escape",
        })
      );
      await waitFor(
        () => root.getAttribute("data-fennevia-visible") === "false",
        "FENNEVIA_FIREFOX_TEST_TAB_STRIP_DISMISS_TIMEOUT"
      );

      return {
        arrowWrapped,
        backgroundCloseDidNotSelect,
        closeButtonRestoredFocus,
        closeFocusDiagnostics,
        failedFaviconFallback,
        finalCustomTabCount: customTabs().length,
        finalNativeTabCount: gBrowser.openTabs.length,
        homeSelectedFirst,
        loadingStateCleared,
        loadingStateVisible,
        manyTabsOverflow,
        pinDidNotSelect,
        pinnedLayoutStable,
        rapidCleanupComplete,
        selectedCloseRestoredFocus,
        synchronizedAfterBurst,
        surfaceDismissedAfterExercise: true,
        titleInjectionSafe,
        unpinDidNotSelect,
      };
    })();
    `);
  } finally {
    for (const timer of responseTimers) {
      clearTimeout(timer);
    }
    responseTimers.clear();
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
}

function assertTabStripMvp(result) {
  const { closeFocusDiagnostics, ...actual } = result;
  const expected = {
    arrowWrapped: true,
    backgroundCloseDidNotSelect: true,
    closeButtonRestoredFocus: true,
    failedFaviconFallback: true,
    finalCustomTabCount: 1,
    finalNativeTabCount: 1,
    homeSelectedFirst: true,
    loadingStateCleared: true,
    loadingStateVisible: true,
    manyTabsOverflow: true,
    pinDidNotSelect: true,
    pinnedLayoutStable: true,
    rapidCleanupComplete: true,
    selectedCloseRestoredFocus: true,
    synchronizedAfterBurst: true,
    surfaceDismissedAfterExercise: true,
    titleInjectionSafe: true,
    unpinDidNotSelect: true,
  };
  try {
    assert.deepEqual(actual, expected);
  } catch (error) {
    console.error(
      `tabStripDiagnostics=${JSON.stringify({ closeFocusDiagnostics, expected, result })}`,
    );
    throw error;
  }
}

async function exerciseBookmarksMvp(client) {
  const requests = { current: 0, newTab: 0 };
  const server = createServer((request, response) => {
    const pathname = new URL(request.url ?? "/", "http://127.0.0.1").pathname;
    if (pathname === "/bookmark-current") {
      requests.current += 1;
    } else if (pathname === "/bookmark-new-tab") {
      requests.newTab += 1;
    } else {
      response.writeHead(404, {
        "Cache-Control": "no-store",
        "Content-Type": "text/plain; charset=utf-8",
      });
      response.end("not found");
      return;
    }
    response.writeHead(200, {
      "Cache-Control": "no-store",
      "Content-Type": "text/html; charset=utf-8",
    });
    response.end(
      `<!doctype html><title>Fennevia bookmark opening probe</title><main>${pathname}</main>`,
    );
  });

  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("FENNEVIA_FIREFOX_TEST_BOOKMARK_SERVER_INVALID");
  }
  const baseUrl = `http://127.0.0.1:${address.port}`;
  const folderGuid = "fennevia14F_";
  const firstGuid = "fennevia14A_";
  const secondGuid = "fennevia14B_";

  const removeFixtures = async () => {
    await client.execute(`
      return (async () => {
        const { PlacesUtils } = ChromeUtils.importESModule(
          "resource://gre/modules/PlacesUtils.sys.mjs"
        );
        for (const guid of [
          ${JSON.stringify(folderGuid)},
          ${JSON.stringify(secondGuid)},
          ${JSON.stringify(firstGuid)},
        ]) {
          if (await PlacesUtils.bookmarks.fetch(guid)) {
            await PlacesUtils.bookmarks.remove(guid);
          }
        }
      })();
    `);
  };

  try {
    await removeFixtures();
    const result = await client.execute(`
      return (async () => {
        const { PlacesUtils } = ChromeUtils.importESModule(
          "resource://gre/modules/PlacesUtils.sys.mjs"
        );
        const bookmarks = PlacesUtils.bookmarks;
        const folderGuid = ${JSON.stringify(folderGuid)};
        const firstGuid = ${JSON.stringify(firstGuid)};
        const secondGuid = ${JSON.stringify(secondGuid)};
        const currentUrl = ${JSON.stringify(`${baseUrl}/bookmark-current`)};
        const newTabUrl = ${JSON.stringify(`${baseUrl}/bookmark-new-tab`)};
        const folderTitle = "Fennevia live folder";
        const firstTitle = "Fennevia bookmark A";
        const renamedTitle =
          "Fennevia <img data-fennevia-bookmark-injected> 😀 \u202e title";
        const secondTitle = "Fennevia bookmark B";
        const rightRoot = document.getElementById("fennevia-shell-right-root");
        const focusOrigin = document.getElementById("urlbar-input");
        if (!rightRoot || !focusOrigin) {
          throw new Error("FENNEVIA_FIREFOX_TEST_BOOKMARK_PANEL_MISSING");
        }

        const waitFor = async (predicate, code) => {
          const deadline = Date.now() + 6000;
          while (Date.now() < deadline) {
            if (predicate()) {
              return;
            }
            await new Promise(resolve => window.setTimeout(resolve, 20));
          }
          throw new Error(code);
        };
        const rootSelect = () =>
          rightRoot.querySelector("select[data-fennevia-bookmark-roots]");
        const rootOptions = () => [
          ...rightRoot.querySelectorAll("[data-fennevia-bookmark-root]"),
        ];
        const selectRootAt = async (index, code) => {
          const select = rootSelect();
          const option = rootOptions().at(index);
          if (!select || !option) {
            throw new Error(code);
          }
          select.value = option.value;
          select.dispatchEvent(new Event("change", { bubbles: true }));
          await waitFor(
            () => select.value === option.value && option.selected,
            code
          );
        };
        const itemButtons = () => [
          ...rightRoot.querySelectorAll("[data-fennevia-bookmark-item]"),
        ];
        const itemByTitle = (title, depth = null) =>
          itemButtons().find(button => {
            if (button.getAttribute("title") !== title) {
              return false;
            }
            if (depth === null) {
              return true;
            }
            return (
              button.parentElement?.style.getPropertyValue(
                "--fennevia-bookmark-depth"
              ) === String(depth)
            );
          });
        const dispatchKey = (target, key, modifiers = {}) => {
          target.dispatchEvent(
            new KeyboardEvent("keydown", {
              bubbles: true,
              cancelable: true,
              key,
              ...modifiers,
            })
          );
        };
        const revealRight = () =>
          window.dispatchEvent(
            new KeyboardEvent("keydown", {
              altKey: true,
              bubbles: true,
              cancelable: true,
              ctrlKey: true,
              key: "ArrowRight",
              shiftKey: true,
            })
          );
        const ensureVisible = async () => {
          if (rightRoot.getAttribute("data-fennevia-visible") === "true") {
            return;
          }
          focusOrigin.focus();
          revealRight();
          await waitFor(
            () => rightRoot.getAttribute("data-fennevia-visible") === "true",
            "FENNEVIA_FIREFOX_TEST_BOOKMARK_REVEAL_RETRY_TIMEOUT"
          );
        };
        const dismiss = () =>
          window.dispatchEvent(
            new KeyboardEvent("keydown", {
              bubbles: true,
              cancelable: true,
              key: "Escape",
            })
          );

        focusOrigin.focus();
        revealRight();
        await waitFor(
          () =>
            rightRoot.getAttribute("data-fennevia-visible") === "true" &&
            document.activeElement === rootSelect(),
          "FENNEVIA_FIREFOX_TEST_BOOKMARK_REVEAL_TIMEOUT"
        );
        await selectRootAt(1, "FENNEVIA_FIREFOX_TEST_BOOKMARK_ROOT_MENU_TIMEOUT");
        await selectRootAt(
          2,
          "FENNEVIA_FIREFOX_TEST_BOOKMARK_ROOT_OTHER_TIMEOUT"
        );
        dismiss();
        await waitFor(
          () => rightRoot.getAttribute("data-fennevia-visible") === "false",
          "FENNEVIA_FIREFOX_TEST_BOOKMARK_INITIAL_DISMISS_TIMEOUT"
        );

        await bookmarks.insert({
          guid: folderGuid,
          parentGuid: bookmarks.unfiledGuid,
          title: folderTitle,
          type: bookmarks.TYPE_FOLDER,
        });
        await bookmarks.insert({
          guid: firstGuid,
          parentGuid: folderGuid,
          title: firstTitle,
          type: bookmarks.TYPE_BOOKMARK,
          url: currentUrl + "-before-update",
        });
        await bookmarks.insert({
          guid: secondGuid,
          parentGuid: folderGuid,
          title: secondTitle,
          type: bookmarks.TYPE_BOOKMARK,
          url: newTabUrl,
        });
        await bookmarks.insert({
          parentGuid: folderGuid,
          type: bookmarks.TYPE_SEPARATOR,
        });
        await waitFor(
          () => Boolean(itemByTitle(folderTitle, 0)),
          "FENNEVIA_FIREFOX_TEST_BOOKMARK_HIDDEN_CREATE_TIMEOUT"
        );
        const hiddenCreateReflected =
          rightRoot.getAttribute("data-fennevia-visible") === "false";

        focusOrigin.focus();
        revealRight();
        await waitFor(
          () => rightRoot.getAttribute("data-fennevia-visible") === "true",
          "FENNEVIA_FIREFOX_TEST_BOOKMARK_SECOND_REVEAL_TIMEOUT"
        );
        const folderButton = itemByTitle(folderTitle, 0);
        folderButton.focus();
        dispatchKey(folderButton, "ArrowRight");
        await waitFor(
          () =>
            folderButton.getAttribute("aria-expanded") === "true" &&
            Boolean(itemByTitle(firstTitle, 1)) &&
            Boolean(itemByTitle(secondTitle, 1)),
          "FENNEVIA_FIREFOX_TEST_BOOKMARK_EXPAND_TIMEOUT"
        );
        dispatchKey(folderButton, "ArrowRight");
        await waitFor(
          () => document.activeElement === itemByTitle(firstTitle, 1),
          "FENNEVIA_FIREFOX_TEST_BOOKMARK_CHILD_FOCUS_TIMEOUT"
        );
        const keyboardExpansionWorked = true;
        const separatorRendered =
          rightRoot.querySelectorAll("[data-fennevia-bookmark-separator]")
            .length === 1;

        await bookmarks.update({
          guid: firstGuid,
          title: renamedTitle,
          url: currentUrl,
        });
        await waitFor(
          () => Boolean(itemByTitle(renamedTitle, 1)),
          "FENNEVIA_FIREFOX_TEST_BOOKMARK_RENAME_TIMEOUT"
        );
        const renamedButton = itemByTitle(renamedTitle, 1);
        const renamePreservedFocus = document.activeElement === renamedButton;
        const titleInjectionSafe =
          !rightRoot.querySelector("[data-fennevia-bookmark-injected]") &&
          renamedButton.textContent.includes(renamedTitle);

        dispatchKey(renamedButton, "Enter");
        await waitFor(
          () => gBrowser.selectedBrowser.currentURI.spec === currentUrl,
          "FENNEVIA_FIREFOX_TEST_BOOKMARK_CURRENT_OPEN_TIMEOUT"
        );
        const currentTabOpenedNative = true;
        await ensureVisible();

        await bookmarks.update({
          guid: secondGuid,
          index: bookmarks.DEFAULT_INDEX,
          parentGuid: bookmarks.unfiledGuid,
        });
        await waitFor(
          () => Boolean(itemByTitle(secondTitle, 0)),
          "FENNEVIA_FIREFOX_TEST_BOOKMARK_MOVE_TIMEOUT"
        );
        const moveReflected = !itemByTitle(secondTitle, 1);

        await bookmarks.reorder(bookmarks.unfiledGuid, [
          secondGuid,
          folderGuid,
        ]);
        await waitFor(
          () => {
            const rootLevelTitles = itemButtons()
              .filter(
                button =>
                  button.parentElement?.style.getPropertyValue(
                    "--fennevia-bookmark-depth"
                  ) === "0"
              )
              .map(button => button.getAttribute("title"));
            return (
              rootLevelTitles.at(0) === secondTitle &&
              rootLevelTitles.at(1) === folderTitle
            );
          },
          "FENNEVIA_FIREFOX_TEST_BOOKMARK_REORDER_TIMEOUT"
        );
        const reorderReflected = true;

        const nativeTabCountBeforeOpen = gBrowser.openTabs.length;
        const secondButton = itemByTitle(secondTitle, 0);
        secondButton.focus();
        dispatchKey(secondButton, "Enter", { ctrlKey: true });
        await waitFor(
          () =>
            gBrowser.openTabs.length === nativeTabCountBeforeOpen + 1 &&
            gBrowser.openTabs.some(
              tab => tab.linkedBrowser.currentURI.spec === newTabUrl
            ),
          "FENNEVIA_FIREFOX_TEST_BOOKMARK_NEW_TAB_OPEN_TIMEOUT"
        );
        const newTabOpenedNative = true;
        const openedTab = gBrowser.openTabs.find(
          tab => tab.linkedBrowser.currentURI.spec === newTabUrl
        );
        gBrowser.removeTab(openedTab, {
          animate: false,
          isUserTriggered: true,
        });
        await waitFor(
          () => gBrowser.openTabs.length === nativeTabCountBeforeOpen,
          "FENNEVIA_FIREFOX_TEST_BOOKMARK_NEW_TAB_CLOSE_TIMEOUT"
        );

        await ensureVisible();
        const focusedBeforeDelete = itemByTitle(renamedTitle, 1);
        focusedBeforeDelete.focus();
        await bookmarks.remove(firstGuid);
        await waitFor(
          () => !itemByTitle(renamedTitle),
          "FENNEVIA_FIREFOX_TEST_BOOKMARK_DELETE_TIMEOUT"
        );
        await waitFor(
          () => document.activeElement === itemByTitle(folderTitle, 0),
          "FENNEVIA_FIREFOX_TEST_BOOKMARK_DELETE_FOCUS_TIMEOUT"
        );
        const deleteRestoredNearestFocus = true;

        await bookmarks.remove(folderGuid);
        await bookmarks.remove(secondGuid);
        await waitFor(
          () =>
            !itemByTitle(folderTitle) &&
            !itemByTitle(firstTitle) &&
            !itemByTitle(renamedTitle) &&
            !itemByTitle(secondTitle),
          "FENNEVIA_FIREFOX_TEST_BOOKMARK_CLEANUP_TIMEOUT"
        );
        const nativeChangesCleaned = true;
        const selectedRootRetained = rootOptions().at(2)?.selected === true;
        const urlNeverEnteredDom =
          rightRoot.querySelectorAll("[href], [src], [data-url]").length === 0;
        dismiss();
        await waitFor(
          () => rightRoot.getAttribute("data-fennevia-visible") === "false",
          "FENNEVIA_FIREFOX_TEST_BOOKMARK_FINAL_DISMISS_TIMEOUT"
        );

        return {
          currentTabOpenedNative,
          deleteRestoredNearestFocus,
          hiddenCreateReflected,
          keyboardExpansionWorked,
          moveReflected,
          nativeChangesCleaned,
          newTabOpenedNative,
          reorderReflected,
          renamePreservedFocus,
          selectedRootRetained,
          separatorRendered,
          surfaceDismissed: true,
          titleInjectionSafe,
          urlNeverEnteredDom,
        };
      })();
    `);
    return { ...result, requests: { ...requests } };
  } finally {
    try {
      await removeFixtures();
    } finally {
      server.closeAllConnections();
      await new Promise((resolve) => server.close(resolve));
    }
  }
}

function assertBookmarksMvp(result) {
  for (const key of [
    "currentTabOpenedNative",
    "deleteRestoredNearestFocus",
    "hiddenCreateReflected",
    "keyboardExpansionWorked",
    "moveReflected",
    "nativeChangesCleaned",
    "newTabOpenedNative",
    "reorderReflected",
    "renamePreservedFocus",
    "selectedRootRetained",
    "separatorRendered",
    "surfaceDismissed",
    "titleInjectionSafe",
    "urlNeverEnteredDom",
  ]) {
    assert.equal(result[key], true, key);
  }
  assert.ok(result.requests.current >= 1);
  assert.ok(result.requests.newTab >= 1);
}

async function assertNativeStylesIsolated(client) {
  const result = await client.execute(`
    const style = document.getElementById("fennevia-shell-app-style");
    if (!style) {
      throw new Error("FENNEVIA_FIREFOX_TEST_FRONTEND_STYLE_MISSING");
    }
    const selectors = [
      "#navigator-toolbox",
      "#sidebar-box",
      "#mainPopupSet",
      "#urlbar-input",
      "#PanelUI-menu-button",
      "#window-modal-dialog",
    ];
    const properties = [
      "appearance",
      "backgroundColor",
      "borderTopColor",
      "color",
      "display",
      "fontFamily",
      "fontSize",
      "pointerEvents",
      "position",
    ];
    const snapshot = () =>
      Object.fromEntries(
        selectors.map(selector => {
          const element = document.querySelector(selector);
          if (!element) {
            return [selector, null];
          }
          const computed = getComputedStyle(element);
          return [
            selector,
            Object.fromEntries(
              properties.map(property => [property, computed[property]])
            ),
          ];
        })
      );
    const enabled = snapshot();
    style.disabled = true;
    const disabled = snapshot();
    style.disabled = false;
    const restored = snapshot();
    return { disabled, enabled, restored, styleEnabled: !style.disabled };
  `);
  for (const value of Object.values(result.enabled)) {
    assert.notEqual(value, null);
  }
  assert.deepEqual(result.enabled, result.disabled);
  assert.deepEqual(result.restored, result.enabled);
  assert.equal(result.styleEnabled, true);
}

async function exerciseDownloadsMvp(client) {
  return client.execute(`
    return (async () => {
      const { Downloads } = ChromeUtils.importESModule(
        "resource://gre/modules/Downloads.sys.mjs"
      );
      const bottomRoot = document.getElementById(
        "fennevia-shell-bottom-root"
      );
      const focusOrigin = document.getElementById("urlbar-input");
      const windowKind = bottomRoot?.getAttribute("data-fennevia-window-kind");
      if (!bottomRoot || !focusOrigin ||
          (windowKind !== "normal" && windowKind !== "private")) {
        throw new Error("FENNEVIA_FIREFOX_TEST_DOWNLOAD_PANEL_MISSING");
      }

      const isPrivate = windowKind === "private";
      const list = await Downloads.getList(
        isPrivate ? Downloads.PRIVATE : Downloads.PUBLIC
      );
      const created = [];
      const sourceSentinel =
        "https://sensitive.example.invalid/fennevia-download-source?value=private";
      const fileSentinel = "FENNEVIA_PRIVATE_DOWNLOAD_NAME.bin";
      const tempDirectory = Services.dirsvc.get("TmpD", Ci.nsIFile).path;
      const separator = tempDirectory.includes("\\\\") ? "\\\\" : "/";

      const waitFor = async (predicate, code) => {
        const deadline = Date.now() + 6000;
        while (Date.now() < deadline) {
          if (predicate()) {
            return;
          }
          await new Promise(resolve => window.setTimeout(resolve, 20));
        }
        throw new Error(code);
      };
      const panel = () => bottomRoot.querySelector("[data-fennevia-downloads]");
      const summary = () =>
        bottomRoot
          .querySelector("[data-fennevia-download-summary]")
          ?.textContent?.trim() ?? "";
      const progress = () =>
        bottomRoot.querySelector("[data-fennevia-download-progress]");
      const downloadLight = () =>
        bottomRoot.querySelector('[data-fennevia-progress-light="download"]');
      const states = () => [
        ...bottomRoot.querySelectorAll("[data-fennevia-download-state]"),
      ].map(item => item.getAttribute("data-fennevia-download-state"));
      const createDownload = async (sequence, state) => {
        const target =
          tempDirectory + separator + "fennevia-32-" + sequence + "-" + fileSentinel;
        const candidate = await Downloads.createDownload({
          source: { isPrivate, url: sourceSentinel + "&item=" + sequence },
          target,
        });
        Object.assign(candidate, state);
        created.push(candidate);
        await list.add(candidate);
        return candidate;
      };
      const change = (candidate, state) => {
        Object.assign(candidate, state);
        candidate.onchange?.();
      };
      const revealBottom = () =>
        window.dispatchEvent(
          new KeyboardEvent("keydown", {
            altKey: true,
            bubbles: true,
            cancelable: true,
            ctrlKey: true,
            key: "ArrowDown",
            shiftKey: true,
          })
        );
      const dismiss = () =>
        window.dispatchEvent(
          new KeyboardEvent("keydown", {
            bubbles: true,
            cancelable: true,
            key: "Escape",
          })
        );

      let result;
      try {
        await waitFor(
          () => panel()?.getAttribute("data-fennevia-downloads-phase") === "ready",
          "FENNEVIA_FIREFOX_TEST_DOWNLOAD_READY_TIMEOUT"
        );
        const first = await createDownload(1, {
          canceled: false,
          currentBytes: 25,
          error: null,
          hasPartialData: false,
          hasProgress: true,
          progress: 25,
          stopped: false,
          succeeded: false,
          totalBytes: 100,
        });
        const second = await createDownload(2, {
          canceled: false,
          currentBytes: 100,
          error: null,
          hasPartialData: false,
          hasProgress: true,
          progress: 50,
          stopped: false,
          succeeded: false,
          totalBytes: 200,
        });
        await waitFor(
          () =>
            summary() === "2 downloads active" &&
            progress()?.getAttribute("data-fennevia-download-progress") ===
              "determinate" &&
            progress()?.querySelector('[role="progressbar"]')
              ?.getAttribute("aria-valuenow") === "41" &&
            downloadLight()?.getAttribute("data-fennevia-progress-mode") ===
              "determinate" &&
            downloadLight()?.getAttribute("data-fennevia-progress-visible") ===
              "true",
          "FENNEVIA_FIREFOX_TEST_DOWNLOAD_KNOWN_TIMEOUT"
        );
        const knownWeighted = true;
        const hiddenKnownActivity =
          bottomRoot.getAttribute("data-fennevia-visible") === "false";
        const lightVisibleWhilePanelHidden =
          hiddenKnownActivity &&
          downloadLight()?.getAttribute("data-fennevia-progress-visible") ===
            "true";

        const unknown = await createDownload(3, {
          canceled: false,
          currentBytes: 7,
          error: null,
          hasPartialData: false,
          hasProgress: false,
          progress: 0,
          stopped: false,
          succeeded: false,
          totalBytes: 0,
        });
        await waitFor(
          () =>
            progress()?.getAttribute("data-fennevia-download-progress") ===
              "indeterminate" &&
            !progress()?.querySelector('[role="progressbar"]')
              ?.hasAttribute("aria-valuenow") &&
            downloadLight()?.getAttribute("data-fennevia-progress-mode") ===
              "indeterminate",
          "FENNEVIA_FIREFOX_TEST_DOWNLOAD_UNKNOWN_TIMEOUT"
        );
        const mixedUnknownIndeterminate = true;
        const hiddenUnknownActivity =
          bottomRoot.getAttribute("data-fennevia-visible") === "false";

        focusOrigin.focus();
        revealBottom();
        await waitFor(
          () => bottomRoot.getAttribute("data-fennevia-visible") === "true",
          "FENNEVIA_FIREFOX_TEST_DOWNLOAD_REVEAL_TIMEOUT"
        );
        const keyboardRevealWorked = true;
        const noFeatureActions =
          panel()?.querySelectorAll("button, a[href]").length === 0;
        dismiss();
        await waitFor(
          () => bottomRoot.getAttribute("data-fennevia-visible") === "false",
          "FENNEVIA_FIREFOX_TEST_DOWNLOAD_DISMISS_TIMEOUT"
        );

        change(first, {
          canceled: true,
          hasPartialData: true,
          stopped: true,
        });
        await waitFor(
          () => states().includes("paused"),
          "FENNEVIA_FIREFOX_TEST_DOWNLOAD_PAUSE_TIMEOUT"
        );
        const pausedExternally = true;
        change(first, {
          canceled: false,
          hasPartialData: false,
          stopped: false,
        });
        await waitFor(
          () => !states().includes("paused") && states().includes("active"),
          "FENNEVIA_FIREFOX_TEST_DOWNLOAD_RESUME_TIMEOUT"
        );
        const resumedExternally = true;

        change(first, {
          currentBytes: 100,
          progress: 100,
          stopped: true,
          succeeded: true,
        });
        change(second, {
          error: new Downloads.Error({ message: "Fennevia test failure" }),
          stopped: true,
        });
        change(unknown, {
          canceled: true,
          stopped: true,
        });
        await waitFor(
          () =>
            summary() === "1 recent failure" &&
            ["succeeded", "failed", "canceled"].every(state =>
              states().includes(state)
            ),
          "FENNEVIA_FIREFOX_TEST_DOWNLOAD_TERMINAL_TIMEOUT"
        );
        const terminalStatesVisible = true;
        const terminalActivityStayedHidden =
          bottomRoot.getAttribute("data-fennevia-visible") === "false";

        const zero = await createDownload(4, {
          canceled: false,
          currentBytes: 0,
          error: null,
          hasPartialData: false,
          hasProgress: true,
          progress: 0,
          stopped: false,
          succeeded: false,
          totalBytes: 0,
        });
        await waitFor(
          () =>
            progress()?.getAttribute("data-fennevia-download-progress") ===
              "determinate" &&
            progress()?.querySelector('[role="progressbar"]')
              ?.getAttribute("aria-valuenow") === "0",
          "FENNEVIA_FIREFOX_TEST_DOWNLOAD_ZERO_TIMEOUT"
        );
        const zeroSizeDeterminate = true;

        const small = await createDownload(5, {
          canceled: false,
          currentBytes: 1,
          error: null,
          hasPartialData: false,
          hasProgress: true,
          progress: 100,
          stopped: false,
          succeeded: false,
          totalBytes: 1,
        });
        const large = await createDownload(6, {
          canceled: false,
          currentBytes: 2684354560,
          error: null,
          hasPartialData: false,
          hasProgress: true,
          progress: 50,
          stopped: false,
          succeeded: false,
          totalBytes: 5368709120,
        });
        await waitFor(
          () =>
            progress()?.querySelector('[role="progressbar"]')
              ?.getAttribute("aria-valuenow") === "50",
          "FENNEVIA_FIREFOX_TEST_DOWNLOAD_SIZE_RANGE_TIMEOUT"
        );
        const smallAndLargeWeighted = true;

        for (let index = 7; index < 15; index += 1) {
          await createDownload(index, {
            canceled: false,
            currentBytes: index,
            error: null,
            hasPartialData: false,
            hasProgress: true,
            progress: index,
            stopped: false,
            succeeded: false,
            totalBytes: 100,
          });
        }
        await waitFor(
          () => states().length === 6,
          "FENNEVIA_FIREFOX_TEST_DOWNLOAD_BURST_TIMEOUT"
        );
        const burstBounded =
          states().length === 6 &&
          bottomRoot.querySelectorAll(".fennevia-downloads__more").length === 1;
        const noSensitiveDom =
          !bottomRoot.textContent.includes(sourceSentinel) &&
          !bottomRoot.textContent.includes(fileSentinel) &&
          bottomRoot.querySelectorAll(
            "[href], [src], [data-url], [data-path], [data-filename]"
          ).length === 0;
        const allUpdatesStayedHidden =
          bottomRoot.getAttribute("data-fennevia-visible") === "false";
        const nativeButton = document.getElementById("downloads-button");
        const nativePanel = document.getElementById("downloadsPanel");
        if (!nativeButton || !nativePanel) {
          throw new Error("FENNEVIA_FIREFOX_TEST_NATIVE_DOWNLOADS_MISSING");
        }
        const nativeToolbox = document.getElementById("navigator-toolbox");
        const documentRoot = document.documentElement;
        nativeToolbox.dispatchEvent(
          new PointerEvent("pointerenter", { bubbles: false })
        );
        await waitFor(
          () =>
            documentRoot.hasAttribute("data-fennevia-native-ui-revealed") &&
            getComputedStyle(document.getElementById("nav-bar")).visibility !==
              "collapse",
          "FENNEVIA_FIREFOX_TEST_NATIVE_DOWNLOADS_REVEAL_TIMEOUT"
        );
        const nativeUiRevealedForDownloads = true;
        nativeButton.click();
        await waitFor(
          () => nativePanel.state === "open",
          "FENNEVIA_FIREFOX_TEST_NATIVE_DOWNLOADS_OPEN_TIMEOUT"
        );
        nativeToolbox.dispatchEvent(
          new PointerEvent("pointerleave", {
            bubbles: false,
            relatedTarget: document.getElementById("browser"),
          })
        );
        await new Promise(resolve => window.setTimeout(resolve, 260));
        const nativePopupHeldReveal = documentRoot.hasAttribute(
          "data-fennevia-native-ui-revealed"
        );
        const nativeDownloadsRetained =
          bottomRoot.getAttribute("data-fennevia-visible") === "false";
        nativePanel.hidePopup();
        await waitFor(
          () => nativePanel.state === "closed",
          "FENNEVIA_FIREFOX_TEST_NATIVE_DOWNLOADS_CLOSE_TIMEOUT"
        );
        await waitFor(
          () =>
            !documentRoot.hasAttribute("data-fennevia-native-ui-revealed"),
          "FENNEVIA_FIREFOX_TEST_NATIVE_DOWNLOADS_HIDE_TIMEOUT"
        );
        const nativeUiHidAfterDownloads = true;

        result = {
          allUpdatesStayedHidden,
          burstBounded,
          hiddenKnownActivity,
          hiddenUnknownActivity,
          keyboardRevealWorked,
          knownWeighted,
          lightVisibleWhilePanelHidden,
          mixedUnknownIndeterminate,
          nativeDownloadsRetained,
          nativePopupHeldReveal,
          nativeUiHidAfterDownloads,
          nativeUiRevealedForDownloads,
          noFeatureActions,
          noSensitiveDom,
          pausedExternally,
          resumedExternally,
          smallAndLargeWeighted,
          terminalActivityStayedHidden,
          terminalStatesVisible,
          windowKind,
          zeroSizeDeterminate,
        };
        void zero;
        void small;
        void large;
      } finally {
        for (const candidate of created.reverse()) {
          await list.remove(candidate);
        }
        await waitFor(
          () =>
            summary() === "No active downloads" &&
            states().length === 0 &&
            downloadLight()?.getAttribute("data-fennevia-progress-visible") ===
              "false",
          "FENNEVIA_FIREFOX_TEST_DOWNLOAD_CLEANUP_TIMEOUT"
        );
      }
      return { ...result, cleanupComplete: true };
    })();
  `);
}

function assertDownloadsMvp(result, windowKind) {
  assert.deepEqual(result, {
    allUpdatesStayedHidden: true,
    burstBounded: true,
    cleanupComplete: true,
    hiddenKnownActivity: true,
    hiddenUnknownActivity: true,
    keyboardRevealWorked: true,
    knownWeighted: true,
    lightVisibleWhilePanelHidden: true,
    mixedUnknownIndeterminate: true,
    nativeDownloadsRetained: true,
    nativePopupHeldReveal: true,
    nativeUiHidAfterDownloads: true,
    nativeUiRevealedForDownloads: true,
    noFeatureActions: true,
    noSensitiveDom: true,
    pausedExternally: true,
    resumedExternally: true,
    smallAndLargeWeighted: true,
    terminalActivityStayedHidden: true,
    terminalStatesVisible: true,
    windowKind,
    zeroSizeDeterminate: true,
  });
}

async function exerciseFrontendUnmountRemount(client) {
  return client.execute(`
    return (async () => {
      const XHTML_NS = "http://www.w3.org/1999/xhtml";
      const edgeNames = ["top", "left", "right", "bottom"];
      const key = "__fenneviaRegisterShellFrontend";
      if (document.getElementById("fennevia-shell-frame-host") || key in window) {
        throw new Error("FENNEVIA_FIREFOX_TEST_FRONTEND_REMOUNT_PRECONDITION");
      }

      let api;
      Object.defineProperty(window, key, {
        configurable: true,
        value(candidate) {
          api = candidate;
        },
      });
      try {
        Services.scriptloader.loadSubScript(
          "chrome://fennevia/content/shell/ShellApp.js",
          window,
          "UTF-8"
        );
      } finally {
        Reflect.deleteProperty(window, key);
      }
      if (!api) {
        throw new Error("FENNEVIA_FIREFOX_TEST_FRONTEND_API_MISSING");
      }

      const frame = document.createElementNS(XHTML_NS, "div");
      frame.id = "fennevia-shell-frame-host";
      frame.setAttribute("data-fennevia-environment", "normal");
      const targets = {};
      for (const edge of edgeNames) {
        const host = document.createElementNS(XHTML_NS, "section");
        host.id = "fennevia-shell-" + edge + "-host";
        host.setAttribute("data-fennevia-edge-host", edge);
        const target = document.createElementNS(XHTML_NS, "div");
        target.id = "fennevia-shell-" + edge + "-mount";
        host.append(target);
        frame.append(host);
        targets[edge] = target;
      }
      const overlayHost = document.createElementNS(XHTML_NS, "section");
      overlayHost.id = "fennevia-shell-address-overlay-host";
      overlayHost.setAttribute("data-fennevia-overlay-host", "address");
      const overlayTarget = document.createElementNS(XHTML_NS, "div");
      overlayTarget.id = "fennevia-shell-address-overlay-mount";
      overlayHost.append(overlayTarget);
      frame.append(overlayHost);
      document.getElementById("browser").insertBefore(
        frame,
        document.getElementById("tabbrowser-tabbox")
      );

      const prototype = window.EventTarget.prototype;
      const originalAdd = prototype.addEventListener;
      const originalRemove = prototype.removeEventListener;
      const registrations = [];
      const captureOf = options =>
        options === true || Boolean(options && options.capture);
      prototype.addEventListener = function (type, listener, options) {
        registrations.push({
          capture: captureOf(options),
          listener,
          removed: false,
          target: this,
          type,
        });
        return originalAdd.call(this, type, listener, options);
      };
      prototype.removeEventListener = function (type, listener, options) {
        const capture = captureOf(options);
        const registration = registrations.find(
          candidate =>
            !candidate.removed &&
            candidate.target === this &&
            candidate.type === type &&
            candidate.listener === listener &&
            candidate.capture === capture
        );
        if (registration) {
          registration.removed = true;
        }
        return originalRemove.call(this, type, listener, options);
      };

      let firstDispose;
      let secondDispose;
      let bookmarkSubscriptionCount = 0;
      let bookmarkUnsubscriptionCount = 0;
      let downloadSubscriptionCount = 0;
      let downloadUnsubscriptionCount = 0;
      let navigationSubscriptionCount = 0;
      let navigationUnsubscriptionCount = 0;
      let addressPopupSubscriptionCount = 0;
      let addressPopupUnsubscriptionCount = 0;
      let tabSubscriptionCount = 0;
      let tabUnsubscriptionCount = 0;
      let urlbarCoverageSubscriptionCount = 0;
      let urlbarCoverageUnsubscriptionCount = 0;
      const fatalErrors = [];
      const unmountErrors = [];
      const testTab = Object.freeze({
        faviconUrl: "chrome://branding/content/icon32.png",
        id: "tab-registry-1-handle-1",
        loading: false,
        pinned: false,
        selected: true,
        title: "Remount test tab",
      });
      const tabs = Object.freeze({
        close() {},
        move() {},
        open() { return "tab-registry-1-handle-1"; },
        openContextMenu() {},
        pin() {},
        select() {},
        snapshot() { return Object.freeze([testTab]); },
        subscribe() {
          tabSubscriptionCount += 1;
          let active = true;
          return () => {
            if (!active) {
              return false;
            }
            active = false;
            tabUnsubscriptionCount += 1;
            return true;
          };
        },
        toggleMute() {},
        unpin() {},
      });
      const bookmarkRoots = Object.freeze([
        Object.freeze({
          hasChildren: false,
          id: "bookmark-root-toolbar",
          kind: "folder",
          title: "Bookmarks Toolbar",
        }),
        Object.freeze({
          hasChildren: false,
          id: "bookmark-root-menu",
          kind: "folder",
          title: "Bookmarks Menu",
        }),
        Object.freeze({
          hasChildren: false,
          id: "bookmark-root-unfiled",
          kind: "folder",
          title: "Other Bookmarks",
        }),
        Object.freeze({
          hasChildren: false,
          id: "bookmark-root-mobile",
          kind: "folder",
          title: "Mobile Bookmarks",
        }),
      ]);
      const bookmarks = Object.freeze({
        async children(parentId, { offset = 0 } = {}) {
          return Object.freeze({
            items: Object.freeze([]),
            offset,
            parentId,
            status: "ok",
            totalCount: 0,
            truncated: false,
          });
        },
        async open() {
          return Object.freeze({ reason: "stale", status: "rejected" });
        },
        manage() {
          return true;
        },
        async roots() {
          return bookmarkRoots;
        },
        subscribe() {
          bookmarkSubscriptionCount += 1;
          let active = true;
          return () => {
            if (!active) {
              return false;
            }
            active = false;
            bookmarkUnsubscriptionCount += 1;
            return true;
          };
        },
      });
      const downloads = Object.freeze({
        async ready() { return true; },
        snapshot() {
          return Object.freeze({
            activeCount: 0,
            aggregatePercent: null,
            canceledCount: 0,
            countOverflow: false,
            failedCount: 0,
            items: Object.freeze([]),
            pausedCount: 0,
            phase: "ready",
            progressMode: "none",
            queuedCount: 0,
            revision: 1,
            succeededCount: 0,
            truncated: false,
          });
        },
        subscribe() {
          downloadSubscriptionCount += 1;
          let active = true;
          return () => {
            if (!active) {
              return false;
            }
            active = false;
            downloadUnsubscriptionCount += 1;
            return true;
          };
        },
      });
      const browserTools = Object.freeze({
        async invoke() { return true; },
        snapshot() {
          return Object.freeze({
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
        },
        subscribe() {
          let active = true;
          return () => {
            if (!active) {
              return false;
            }
            active = false;
            return true;
          };
        },
      });
      const navigation = Object.freeze({
        back() { return false; },
        focusContent() { return true; },
        forward() { return false; },
        home() { return true; },
        newTab() { return true; },
        reload() { return true; },
        reloadOrStop() { return "reload"; },
        snapshot() {
          return Object.freeze({
            addressValue: "",
            canGoBack: false,
            canGoForward: false,
            connectionSecurity: "internal",
            displayUri: "about:blank",
            loading: false,
            title: "Remount test page",
            trackingProtection: "unavailable",
          });
        },
        stop() { return false; },
        submitAddress() { return Object.freeze({ status: "accepted" }); },
        subscribe() {
          navigationSubscriptionCount += 1;
          let active = true;
          return () => {
            if (!active) {
              return false;
            }
            active = false;
            navigationUnsubscriptionCount += 1;
            return true;
          };
        },
        subscribeAddressPopupOpen() {
          addressPopupSubscriptionCount += 1;
          let active = true;
          return () => {
            if (!active) {
              return false;
            }
            active = false;
            addressPopupUnsubscriptionCount += 1;
            return true;
          };
        },
      });
      const urlbarCoverage = Object.freeze({
        openNativeUrlbar() { return true; },
        snapshot() {
          return Object.freeze({
            items: Object.freeze(["bookmark"]),
            permissions: Object.freeze({
              available: true,
              blocked: Object.freeze([]),
              hasPermissions: false,
              sharing: Object.freeze([]),
            }),
          });
        },
        subscribe() {
          urlbarCoverageSubscriptionCount += 1;
          let active = true;
          return () => {
            if (!active) {
              return false;
            }
            active = false;
            urlbarCoverageUnsubscriptionCount += 1;
            return true;
          };
        },
      });
      const windowControls = Object.freeze({
        invoke() { return true; },
        snapshot() {
          return Object.freeze({ maximized: false });
        },
        subscribe() {
          let active = true;
          return () => {
            if (!active) {
              return false;
            }
            active = false;
            return true;
          };
        },
      });
      const options = {
        bookmarks,
        browserTools,
        downloads,
        frame,
        navigation,
        onFatalError(error) {
          fatalErrors.push(String(error?.name ?? "unknown"));
        },
        onUnmountError(error) {
          unmountErrors.push(String(error?.name ?? "unknown"));
        },
        overlayTarget,
        tabs,
        targets,
        urlbarCoverage,
        windowControls,
        windowKind: "normal",
      };

      try {
        firstDispose = api.mountShellApp(options);
        await api.verifyShellAppHealth({
          frame,
          overlayTarget,
          targets,
          windowKind: "normal",
        });
        const firstRoots = edgeNames.map(
          edge => targets[edge].firstElementChild
        );
        firstRoots.push(overlayTarget.firstElementChild);
        const firstFavicon = firstRoots[1].querySelector(
          ".fennevia-tab-strip__favicon"
        );
        const firstDisposeResult = firstDispose();
        firstDispose = null;
        await Promise.resolve();
        const firstStatusesDisposed = edgeNames.every(
          edge =>
            targets[edge].getAttribute("data-fennevia-framework-status") ===
            "disposed"
        ) && overlayTarget.getAttribute("data-fennevia-framework-status") ===
          "disposed";
        const descendantsAfterFirstDispose = edgeNames.reduce(
          (count, edge) => count + targets[edge].childNodes.length,
          0
        ) + overlayTarget.childNodes.length;

        secondDispose = api.mountShellApp(options);
        await api.verifyShellAppHealth({
          frame,
          overlayTarget,
          targets,
          windowKind: "normal",
        });
        const secondRoots = edgeNames.map(
          edge => targets[edge].firstElementChild
        );
        secondRoots.push(overlayTarget.firstElementChild);
        const secondRootsAreNew = secondRoots.every(
          (root, index) => root !== firstRoots[index]
        );
        const secondDisposeResult = secondDispose();
        secondDispose = null;
        await Promise.resolve();

        return {
          bookmarkSubscriptionCount,
          bookmarkUnsubscriptionCount,
          descendantsAfterFirstDispose,
          descendantsAfterSecondDispose: edgeNames.reduce(
            (count, edge) => count + targets[edge].childNodes.length,
            0
          ) + overlayTarget.childNodes.length,
          fatalErrorCount: fatalErrors.length,
          downloadSubscriptionCount,
          downloadUnsubscriptionCount,
          firstDisposeResult,
          firstFaviconErrorCleared: firstFavicon.onerror === null,
          firstFaviconSourceCleared: !firstFavicon.hasAttribute("src"),
          firstRootsDisconnected: firstRoots.every(root => !root.isConnected),
          firstRootCount: firstRoots.length,
          firstStatusesDisposed,
          frameReadyAfterDispose:
            frame.hasAttribute("data-fennevia-frontend-ready"),
          listenerAddCount: registrations.length,
          listenerOutstandingCount: registrations.filter(
            registration => !registration.removed
          ).length,
          listenerOutstandingTypes: registrations
            .filter(registration => !registration.removed)
            .map(registration => registration.type)
            .sort(),
          listenerRemoveCount: registrations.filter(
            registration => registration.removed
          ).length,
          navigationSubscriptionCount,
          navigationUnsubscriptionCount,
          addressPopupSubscriptionCount,
          addressPopupUnsubscriptionCount,
          registrationCallbackPresent: Object.hasOwn(window, key),
          secondDisposeResult,
          secondRootCount: secondRoots.length,
          secondRootsAreNew,
          secondStatusesDisposed: edgeNames.every(
            edge =>
              targets[edge].getAttribute("data-fennevia-framework-status") ===
              "disposed"
          ) && overlayTarget.getAttribute("data-fennevia-framework-status") ===
            "disposed",
          tabSubscriptionCount,
          tabUnsubscriptionCount,
          urlbarCoverageSubscriptionCount,
          urlbarCoverageUnsubscriptionCount,
          unmountErrorCount: unmountErrors.length,
        };
      } finally {
        try { firstDispose?.(); } catch {}
        try { secondDispose?.(); } catch {}
        prototype.addEventListener = originalAdd;
        prototype.removeEventListener = originalRemove;
        frame.remove();
        Reflect.deleteProperty(window, key);
      }
    })();
  `);
}
function assertShellHostState(state, windowKind) {
  assert.equal(state.active, true);
  assert.equal(state.browserStillPresent, true);
  assert.equal(state.nativeTabboxStillPresent, true);
  assert.equal(state.nativeModalAvailable, true);
  assert.equal(state.nativeWindowControlsPresent, true);
  assert.equal(state.completeSet, true);
  assert.equal(state.hostCount, 6);
  assert.equal(state.hostIdCount, 6);
  assert.deepEqual(state.health, {
    created: true,
    failed: false,
    healthy: true,
    mounted: true,
    state: "active",
  });
  assert.equal(state.namespaceComplete, true);
  assert.equal(state.ownershipComplete, true);
  assert.equal(state.environment, "normal");
  assert.deepEqual(state.frame, {
    appStyleParent: true,
    browserGeometryPreserved: true,
    parentIsBrowser: true,
    pointerEvents: "none",
    position: "absolute",
    runtimeStyleParent: true,
  });
  try {
    assert.equal(state.nativeUi.styleParentIsFrame, true);
    assert.equal(state.nativeUi.styleRuleCount, 7);
    assert.equal(state.nativeUi.popupProxyAnchorAriaHidden, true);
    assert.equal(state.nativeUi.popupProxyAnchorCount, 1);
    assert.equal(state.nativeUi.popupProxyAnchorParentIsFrame, true);
    assert.equal(state.nativeUi.popupProxyAnchorPointerEvents, "none");
    assert.equal(state.nativeUi.revealed, false);
    assert.equal(state.nativeUi.suspended, false);
    assert.equal(state.nativeUi.identityBoxOwnedByNavBar, true);
    assert.equal(state.nativeUi.trackingProtectionOwnedByNavBar, true);
    assert.equal(state.nativeUi.urlbarOwnedByNavBar, true);
    assert.equal(state.nativeUi.notificationsToolbarPresent, true);
    assert.ok(state.nativeUi.titlebarCloseButtonCount >= 3);
    assert.equal(state.nativeUi.visibleTitlebarCloseButtonCount, 0);
    assert.equal(state.nativeUi.personalToolbar?.visibility, "collapse");
    for (const key of [
      "sidebarBox",
      "sidebarContainer",
      "sidebarLauncherSplitter",
      "sidebarSplitter",
    ]) {
      assert.equal(state.nativeUi[key]?.visibility, "collapse", key);
    }
    if (state.nativeUi.tabsHidden) {
      assert.notEqual(state.nativeUi.navBar?.visibility, "collapse");
      assert.equal(
        state.nativeUi.navBarCustomizationTarget?.visibility,
        "collapse",
      );
    } else {
      assert.equal(state.nativeUi.tabsToolbarItems?.visibility, "collapse");
      assert.equal(state.nativeUi.navBar?.visibility, "collapse");
    }
  } catch (error) {
    console.error(`nativeUiStateDiagnostics=${JSON.stringify(state.nativeUi)}`);
    throw error;
  }
  for (const [index, edge] of ["top", "left", "right", "bottom"].entries()) {
    assert.deepEqual(state.edgeHosts[edge], {
      hostParentIsFrame: true,
      hostPosition: index,
      mountParentIsHost: true,
      mountStatus: "mounted",
      panelHidden: true,
      panelInert: true,
      panelPointerEvents: "none",
      rootEdge: edge,
      rootVisible: "false",
      triggerPointerEvents: "auto",
    });
  }
  assert.deepEqual(state.overlay, {
    hostIsLast: true,
    hostParentIsFrame: true,
    mountParentIsHost: true,
    mountStatus: "mounted",
    popupRootCount: 1,
  });
  assert.equal(state.placement.frameImmediatelyBeforeTabbox, true);
  assert.equal(state.rootCount, 4);
  assert.equal(state.targetCount, 5);
  assert.equal(state.contentHitInsideProjectHost, false);
  assert.equal(windowKind === "normal" || windowKind === "private", true);
}

async function assertNoShellHosts(client) {
  const state = await collectShellHostState(client);
  assert.equal(state.active, false);
  assert.equal(state.browserStillPresent, true);
  assert.equal(state.nativeTabboxStillPresent, true);
  assert.equal(state.nativeWindowControlsPresent, true);
  assert.equal(state.hostCount, 0);
  assert.equal(state.hostIdCount, 0);
  assert.deepEqual(state.health, {
    created: false,
    failed: false,
    healthy: false,
    mounted: false,
    state: null,
  });
}

async function assertNativeModalUnobstructed(client) {
  const state = await client.execute(`
    const dialog = document.getElementById("window-modal-dialog");
    if (!dialog || typeof dialog.showModal !== "function" || dialog.open) {
      return { available: false };
    }
    try {
      dialog.showModal();
      const hit = document.elementFromPoint(
        Math.round(window.innerWidth / 2),
        Math.round(window.innerHeight / 2)
      );
      return {
        available: true,
        hitInsideProjectHost: Boolean(
          hit?.closest?.('[id^="fennevia-shell-"]')
        ),
        modalPseudo: dialog.matches(":modal"),
        open: dialog.open,
      };
    } finally {
      if (dialog.open) {
        dialog.close();
      }
    }
  `);
  assert.deepEqual(state, {
    available: true,
    hitInsideProjectHost: false,
    modalPseudo: true,
    open: true,
  });
}

async function exerciseNativeUiPolicies(client) {
  return client.execute(
    `
    return (async () => {
      const root = document.documentElement;
      const toolbox = document.getElementById("navigator-toolbox");
      const frame = document.getElementById("fennevia-shell-frame-host");
      const navBar = document.getElementById("nav-bar");
      const sidebarBox = document.getElementById("sidebar-box");
      const nativeStyle = document.getElementById("fennevia-native-ui-style");
      if (
        !toolbox ||
        !frame ||
        !navBar ||
        !sidebarBox ||
        !nativeStyle ||
        typeof SidebarController?.show !== "function" ||
        typeof SidebarController?.hide !== "function" ||
        typeof gCustomizeMode?.enter !== "function" ||
        typeof gCustomizeMode?.exit !== "function"
      ) {
        throw new Error("FENNEVIA_FIREFOX_TEST_NATIVE_UI_POLICY_MISSING");
      }

      const waitFor = async (predicate, code, timeoutMs = 15000) => {
        const deadline = Date.now() + timeoutMs;
        while (Date.now() < deadline) {
          if (predicate()) {
            return;
          }
          await new Promise(resolve => window.setTimeout(resolve, 20));
        }
        throw new Error(code);
      };
      const eventAfter = (target, type, action) =>
        new Promise((resolve, reject) => {
          const timer = window.setTimeout(() => {
            target.removeEventListener(type, onEvent);
            reject(new Error("FENNEVIA_FIREFOX_TEST_NATIVE_UI_EVENT_TIMEOUT"));
          }, 15000);
          const onEvent = () => {
            window.clearTimeout(timer);
            resolve();
          };
          target.addEventListener(type, onEvent, { once: true });
          try {
            action();
          } catch (error) {
            window.clearTimeout(timer);
            target.removeEventListener(type, onEvent);
            reject(error);
          }
        });

      const baselineResting =
        root.hasAttribute("data-fennevia-active") &&
        !root.hasAttribute("data-fennevia-native-ui-revealed") &&
        !root.hasAttribute("data-fennevia-native-ui-suspended") &&
        getComputedStyle(navBar).visibility === "collapse";

      let sidebarReachable = false;
      let sidebarHeldReveal = false;
      let sidebarRestored = false;
      let customizeExposedNative = false;
      let customizeRestoredActive = false;
      let browserFullscreenStayedActive = false;
      let browserFullscreenRestored = false;
      let nativeVerticalTabsPreservedTitlebar = false;
      let nativeVerticalTabsRestored = false;
      const originallyFullscreen = window.fullScreen;
      const verticalTabsPref = "sidebar.verticalTabs";
      const hadVerticalTabsUserValue =
        Services.prefs.prefHasUserValue(verticalTabsPref);
      const originalVerticalTabs = Services.prefs.getBoolPref(
        verticalTabsPref,
        false
      );
      try {
        await SidebarController.show("viewHistorySidebar");
        await waitFor(
          () =>
            !sidebarBox.hasAttribute("hidden") &&
            root.hasAttribute("data-fennevia-native-ui-revealed") &&
            getComputedStyle(sidebarBox).visibility !== "collapse",
          "FENNEVIA_FIREFOX_TEST_NATIVE_SIDEBAR_SHOW_TIMEOUT"
        );
        sidebarReachable = SidebarController.currentID === "viewHistorySidebar";
        await new Promise(resolve => window.setTimeout(resolve, 260));
        sidebarHeldReveal = root.hasAttribute(
          "data-fennevia-native-ui-revealed"
        );
        SidebarController.hide();
        await waitFor(
          () => sidebarBox.hasAttribute("hidden"),
          "FENNEVIA_FIREFOX_TEST_NATIVE_SIDEBAR_HIDE_TIMEOUT"
        );
        await new Promise(resolve => window.setTimeout(resolve, 300));
        sidebarRestored =
          !root.hasAttribute("data-fennevia-native-ui-revealed") &&
          getComputedStyle(sidebarBox).visibility === "collapse";

        Services.prefs.setBoolPref(verticalTabsPref, true);
        await waitFor(
          () =>
            toolbox.hasAttribute("tabs-hidden") &&
            getComputedStyle(navBar).visibility !== "collapse" &&
            getComputedStyle(
              document.getElementById("nav-bar-customization-target")
            ).visibility === "collapse",
          "FENNEVIA_FIREFOX_TEST_NATIVE_VERTICAL_TABS_TIMEOUT"
        );
        nativeVerticalTabsPreservedTitlebar = [
          ...navBar.querySelectorAll(
            '.titlebar-buttonbox-container .titlebar-close[command="cmd_closeWindow"]'
          ),
        ].some(button => {
          const rect = button.getBoundingClientRect();
          const computed = getComputedStyle(button);
          return (
            computed.visibility !== "collapse" &&
            computed.visibility !== "hidden" &&
            computed.display !== "none" &&
            rect.width > 0 &&
            rect.height > 0
          );
        });
        if (hadVerticalTabsUserValue) {
          Services.prefs.setBoolPref(verticalTabsPref, originalVerticalTabs);
        } else {
          Services.prefs.clearUserPref(verticalTabsPref);
        }
        await waitFor(
          () =>
            !toolbox.hasAttribute("tabs-hidden") &&
            getComputedStyle(navBar).visibility === "collapse",
          "FENNEVIA_FIREFOX_TEST_NATIVE_VERTICAL_TABS_RESTORE_TIMEOUT"
        );
        nativeVerticalTabsRestored = true;

        await eventAfter(toolbox, "customizationready", () => {
          gCustomizeMode.enter();
        });
        await waitFor(
          () =>
            root.hasAttribute("customizing") &&
            root.hasAttribute("data-fennevia-native-ui-suspended") &&
            frame.getAttribute("data-fennevia-environment") === "customize-mode",
          "FENNEVIA_FIREFOX_TEST_NATIVE_CUSTOMIZE_ENTER_TIMEOUT"
        );
        customizeExposedNative =
          getComputedStyle(frame).visibility === "hidden" &&
          getComputedStyle(navBar).visibility !== "collapse";
        await eventAfter(toolbox, "aftercustomization", () => {
          gCustomizeMode.exit();
        });
        await waitFor(
          () =>
            !root.hasAttribute("customizing") &&
            !root.hasAttribute("data-fennevia-native-ui-suspended") &&
            frame.getAttribute("data-fennevia-environment") === "normal" &&
            getComputedStyle(navBar).visibility === "collapse",
          "FENNEVIA_FIREFOX_TEST_NATIVE_CUSTOMIZE_EXIT_TIMEOUT"
        );
        customizeRestoredActive =
          root.hasAttribute("data-fennevia-active") &&
            nativeStyle.sheet.cssRules.length === 7;

        window.fullScreen = true;
        await waitFor(
          () => root.hasAttribute("inFullscreen") && window.fullScreen,
          "FENNEVIA_FIREFOX_TEST_NATIVE_BROWSER_FULLSCREEN_ENTER_TIMEOUT"
        );
        browserFullscreenStayedActive =
          root.hasAttribute("data-fennevia-active") &&
          frame.getAttribute("data-fennevia-environment") === "normal";
        window.fullScreen = false;
        await waitFor(
          () => !root.hasAttribute("inFullscreen") && !window.fullScreen,
          "FENNEVIA_FIREFOX_TEST_NATIVE_BROWSER_FULLSCREEN_EXIT_TIMEOUT"
        );
        browserFullscreenRestored =
          root.hasAttribute("data-fennevia-active") &&
          getComputedStyle(navBar).visibility === "collapse";
      } finally {
        if (root.hasAttribute("customizing")) {
          try {
            gCustomizeMode.exit();
          } catch {}
        }
        if (!sidebarBox.hasAttribute("hidden")) {
          try {
            SidebarController.hide();
          } catch {}
        }
        if (window.fullScreen !== originallyFullscreen) {
          window.fullScreen = originallyFullscreen;
        }
        if (hadVerticalTabsUserValue) {
          Services.prefs.setBoolPref(verticalTabsPref, originalVerticalTabs);
        } else if (Services.prefs.prefHasUserValue(verticalTabsPref)) {
          Services.prefs.clearUserPref(verticalTabsPref);
        }
      }

      return {
        baselineResting,
        browserFullscreenRestored,
        browserFullscreenStayedActive,
        customizeExposedNative,
        customizeRestoredActive,
        nativeVerticalTabsPreservedTitlebar,
        nativeVerticalTabsRestored,
        sidebarHeldReveal,
        sidebarReachable,
        sidebarRestored,
      };
    })();
  `,
    45000,
  );
}

function assertNativeUiPolicies(result) {
  const expected = {
    baselineResting: true,
    browserFullscreenRestored: true,
    browserFullscreenStayedActive: true,
    customizeExposedNative: true,
    customizeRestoredActive: true,
    nativeVerticalTabsPreservedTitlebar: true,
    nativeVerticalTabsRestored: true,
    sidebarHeldReveal: true,
    sidebarReachable: true,
    sidebarRestored: true,
  };
  try {
    assert.deepEqual(result, expected);
  } catch (error) {
    console.error(
      `nativeUiPolicyDiagnostics=${JSON.stringify({ expected, result })}`,
    );
    throw error;
  }
}

async function exerciseWindowStatePolicy(client) {
  const initialResult = await client.request("WebDriver:GetWindowRect", {});
  const initial = initialResult.value ?? initialResult;
  const target = {
    height: Math.max(520, Math.min(680, initial.height - 80)),
    width: Math.max(720, Math.min(920, initial.width - 120)),
    x: initial.x + 24,
    y: initial.y + 24,
  };
  const inspect = () =>
    client.execute(`
      const frame = document.getElementById("fennevia-shell-frame-host");
      const browser = document.getElementById("browser");
      const style = document.getElementById("fennevia-native-ui-style");
      const frameRect = frame?.getBoundingClientRect();
      const browserRect = browser?.getBoundingClientRect();
      const visibleClose = [
        ...document.querySelectorAll(
          '.titlebar-buttonbox-container .titlebar-close[command="cmd_closeWindow"]'
        ),
      ].some(button => {
        const rect = button.getBoundingClientRect();
        const computed = getComputedStyle(button);
        return computed.display !== "none" &&
          computed.visibility !== "hidden" &&
          computed.visibility !== "collapse" &&
          rect.width > 0 && rect.height > 0;
      });
      return {
        active: document.documentElement.hasAttribute("data-fennevia-active"),
        browserGeometryPreserved:
          Math.round(frameRect?.width ?? -1) ===
            Math.round(browserRect?.width ?? -2) &&
          Math.round(frameRect?.height ?? -1) ===
            Math.round(browserRect?.height ?? -2),
        styleRuleCount: style?.sheet?.cssRules?.length ?? 0,
        visibleClose,
        windowState: window.windowState,
        windowStateMaximized: window.STATE_MAXIMIZED,
        windowStateMinimized: window.STATE_MINIMIZED,
        windowStateNormal: window.STATE_NORMAL,
      };
    `);

  let resized;
  let maximized;
  let minimized;
  let restored;
  try {
    const resizeResult = await client.request(
      "WebDriver:SetWindowRect",
      target,
    );
    const resizeRect = resizeResult.value ?? resizeResult;
    const resizeState = await inspect();
    resized =
      Math.abs(resizeRect.width - target.width) <= 2 &&
      Math.abs(resizeRect.height - target.height) <= 2 &&
      resizeState.active &&
      resizeState.browserGeometryPreserved &&
      resizeState.styleRuleCount === 7 &&
      resizeState.visibleClose;

    await client.request("WebDriver:MaximizeWindow", {});
    const maximizeState = await inspect();
    maximized =
      maximizeState.windowState === maximizeState.windowStateMaximized &&
      maximizeState.active &&
      maximizeState.browserGeometryPreserved &&
      maximizeState.styleRuleCount === 7 &&
      maximizeState.visibleClose;

    await client.request("WebDriver:MinimizeWindow", {});
    const minimizeState = await inspect();
    minimized =
      minimizeState.windowState === minimizeState.windowStateMinimized &&
      minimizeState.active &&
      minimizeState.styleRuleCount === 7;
  } finally {
    await client.request("WebDriver:SetWindowRect", initial);
    const restoreState = await inspect();
    restored =
      restoreState.windowState === restoreState.windowStateNormal &&
      restoreState.active &&
      restoreState.browserGeometryPreserved &&
      restoreState.styleRuleCount === 7 &&
      restoreState.visibleClose;
  }
  return { maximized, minimized, resized, restored };
}

async function exercisePartialNativeUiCssFailOpen(client) {
  return client.execute(`
    return (async () => {
      const root = document.documentElement;
      const style = document.getElementById("fennevia-native-ui-style");
      const navBar = document.getElementById("nav-bar");
      const tabsToolbarItems = document.querySelector(
        "#TabsToolbar > .toolbar-items"
      );
      if (
        !root.hasAttribute("data-fennevia-active") ||
        !style ||
        style.sheet.cssRules.length !== 7 ||
        !navBar ||
        !tabsToolbarItems
      ) {
        throw new Error("FENNEVIA_FIREFOX_TEST_NATIVE_UI_CSS_PRECONDITION");
      }
      style.textContent =
        ":root[data-fennevia-active] #PersonalToolbar { visibility: collapse !important; }";
      const deadline = Date.now() + 10000;
      while (Date.now() < deadline) {
        if (
          !root.hasAttribute("data-fennevia-active") &&
          !document.getElementById("fennevia-shell-frame-host") &&
          !document.getElementById("fennevia-native-ui-style")
        ) {
          break;
        }
        await new Promise(resolve => window.setTimeout(resolve, 20));
      }
      const titlebarButtons = [
        ...document.querySelectorAll(
          '.titlebar-buttonbox-container .titlebar-close[command="cmd_closeWindow"]'
        ),
      ];
      return {
        activeCleared: !root.hasAttribute("data-fennevia-active"),
        hostRemoved: !document.getElementById("fennevia-shell-frame-host"),
        nativeNavigationVisible:
          getComputedStyle(navBar).visibility !== "collapse",
        nativeTabsVisible:
          getComputedStyle(tabsToolbarItems).visibility !== "collapse",
        nativeWindowControlVisible: titlebarButtons.some(button => {
          const rect = button.getBoundingClientRect();
          const computed = getComputedStyle(button);
          return (
            computed.display !== "none" &&
            computed.visibility !== "collapse" &&
            computed.visibility !== "hidden" &&
            rect.width > 0 &&
            rect.height > 0
          );
        }),
        styleRemoved: !document.getElementById("fennevia-native-ui-style"),
      };
    })();
  `);
}

async function exerciseMissingInsertionPointFailOpen(client) {
  return client.execute(`
    return (async () => {
      const { createRuntimeLogger } = ChromeUtils.importESModule(
        "chrome://fennevia/content/runtime/Logger.sys.mjs"
      );
      const { initializeWindowShell, shellHostIds } = ChromeUtils.importESModule(
        "chrome://fennevia/content/runtime/WindowShell.sys.mjs"
      );
      const tabbox = document.getElementById("tabbrowser-tabbox");
      if (!tabbox) {
        throw new Error("FENNEVIA_FIREFOX_TEST_TABBOX_PRECONDITION_FAILED");
      }
      const logger = createRuntimeLogger({
        consoleService: Services.console,
        appInfo: Services.appinfo,
        projectCommit: "unknown",
      });
      const abortController = new AbortController();
      let code = "FENNEVIA_FIREFOX_TEST_NO_FAILURE";
      let domPath = "missing";
      tabbox.id = "fennevia-test-missing-tabbox";
      try {
        await initializeWindowShell({
          context: {
            isDisposed: () => false,
            opaqueId: "window-shell-fail-open-probe",
            signal: abortController.signal,
            window,
            windowKind: "normal",
          },
          logger,
          appInfo: Services.appinfo,
        });
      } catch (error) {
        code = String(error?.fenneviaCode ?? error?.message ?? "unknown");
        domPath = String(error?.fenneviaDomPath ?? "missing");
      } finally {
        tabbox.id = "tabbrowser-tabbox";
      }
      return {
        browserVisible: document.getElementById("browser")?.getBoundingClientRect().height > 0,
        code,
        domPath,
        hostCount: Object.values(shellHostIds).filter(id =>
          document.getElementById(id)
        ).length,
        nativeTabboxRestored: document.getElementById("tabbrowser-tabbox") === tabbox,
        nativeToolboxPresent: Boolean(document.getElementById("navigator-toolbox")),
      };
    })();
  `);
}

async function exerciseEmergencyFallback(client) {
  return client.execute(`
    return new Promise((resolve, reject) => {
      try {
        const utils = window.windowUtils;
        const modifiers =
          utils.NATIVE_MODIFIER_SHIFT_LEFT |
          utils.NATIVE_MODIFIER_CONTROL_LEFT |
          utils.NATIVE_MODIFIER_ALT_LEFT;
        utils.sendNativeKeyEvent(
          0x00000409,
          0x0058007b,
          modifiers,
          "",
          "",
          {
            onCompleteDispatch() {
              window.setTimeout(() => {
                resolve({
                  active: document.documentElement.hasAttribute(
                    "data-fennevia-active"
                  ),
                  hostCount: document.querySelectorAll(
                    '[id^="fennevia-shell-"]'
                  ).length,
                  nativeBrowserPresent: Boolean(
                    document.getElementById("browser")
                  ),
                  nativeToolboxPresent: Boolean(
                    document.getElementById("navigator-toolbox")
                  ),
                  rootState: document.documentElement.getAttribute(
                    "data-fennevia-state"
                  ),
                });
              }, 0);
            },
          }
        );
      } catch (error) {
        reject(error);
      }
    });
  `);
}

async function acceptBrowserToolboxConnectionPrompt(client) {
  const deadline = Date.now() + BROWSER_TOOLBOX_TIMEOUT_MS;
  while (Date.now() < deadline) {
    try {
      const alertResult = await client.request(
        "WebDriver:GetAlertText",
        {},
        5_000,
      );
      const alertText = alertResult?.value ?? alertResult;
      if (typeof alertText === "string") {
        await client.request("WebDriver:AcceptAlert", {}, 5_000);
        return true;
      }
    } catch {
      // The prompt is created asynchronously after the toolbox process starts.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("FENNEVIA_FIREFOX_TEST_BROWSER_TOOLBOX_PROMPT_TIMEOUT");
}

async function cleanupBrowserToolboxProbe(client) {
  return client.execute(
    `
    return (async () => {
      const propertyName = "__fenneviaBrowserToolboxProbe";
      const probe = window[propertyName];
      const { BrowserToolboxLauncher } = ChromeUtils.importESModule(
        "resource://devtools/client/framework/browser-toolbox/Launcher.sys.mjs"
      );
      try {
        if (
          probe?.launcher &&
          BrowserToolboxLauncher.getBrowserToolboxSessionState()
        ) {
          await probe.launcher.close();
        }
      } finally {
        try {
          const profileState = probe?.debuggerProfileState;
          if (profileState) {
            if (!profileState.prepared) {
              if (profileState.backup.exists()) {
                profileState.backup.remove(false);
              }
              if (profileState.marker.exists()) {
                profileState.marker.remove(false);
              }
            } else {
              if (!profileState.marker.exists()) {
                throw new Error(
                  "FENNEVIA_BROWSER_TOOLBOX_PROFILE_MARKER_MISSING"
                );
              }
              if (profileState.originalPrefsExisted) {
                if (!profileState.backup.exists()) {
                  throw new Error(
                    "FENNEVIA_BROWSER_TOOLBOX_PROFILE_BACKUP_MISSING"
                  );
                }
                if (profileState.prefs.exists()) {
                  profileState.prefs.remove(false);
                }
                profileState.backup.moveTo(
                  profileState.directory,
                  profileState.prefs.leafName
                );
              } else if (profileState.prefs.exists()) {
                profileState.prefs.remove(false);
              }
              profileState.marker.remove(false);
            }
          }
        } finally {
          for (const preference of probe?.preferences ?? []) {
            if (!preference.hadUserValue) {
              Services.prefs.clearUserPref(preference.name);
              continue;
            }
            if (preference.type === Ci.nsIPrefBranch.PREF_BOOL) {
              Services.prefs.setBoolPref(preference.name, preference.value);
            } else if (preference.type === Ci.nsIPrefBranch.PREF_INT) {
              Services.prefs.setIntPref(preference.name, preference.value);
            } else if (preference.type === Ci.nsIPrefBranch.PREF_STRING) {
              Services.prefs.setCharPref(preference.name, preference.value);
            }
          }
          delete window[propertyName];
        }
      }
      return {
        promptConnectionEnabled: Services.prefs.getBoolPref(
          "devtools.debugger.prompt-connection",
          false
        ),
        sessionActive: BrowserToolboxLauncher.getBrowserToolboxSessionState(),
        testPropertyRemoved: !Object.hasOwn(window, propertyName),
      };
    })();
  `,
    BROWSER_TOOLBOX_TIMEOUT_MS,
  );
}

async function runBrowserToolboxOwnershipProbe(client) {
  // The test-server connection sequence follows Mozilla's CC0 Browser Toolbox
  // helper at devtools/client/framework/browser-toolbox/test/
  // helpers-browser-toolbox.js (FIREFOX_153_0_4_RELEASE). It is test-only;
  // the child profile is backed up and restored byte-identically below.
  await assertPortAvailable(6001);
  let launchAttempted = false;
  try {
    launchAttempted = true;
    const launchState = await client.execute(
      `
      const propertyName = "__fenneviaBrowserToolboxProbe";
      if (Object.hasOwn(window, propertyName)) {
        throw new Error("FENNEVIA_BROWSER_TOOLBOX_PROBE_ALREADY_ACTIVE");
      }
      for (const requiredPreference of [
        "devtools.chrome.enabled",
        "devtools.debugger.remote-enabled",
        "devtools.debugger.prompt-connection",
      ]) {
        if (!Services.prefs.getBoolPref(requiredPreference, false)) {
          throw new Error(
            "FENNEVIA_BROWSER_TOOLBOX_REQUIRED_PREFERENCE_DISABLED"
          );
        }
      }

      const preferenceNames = [
        "devtools.browsertoolbox.enable-test-server",
        "devtools.browsertoolbox.panel",
        "devtools.browsertoolbox.scope",
      ];
      const preferences = preferenceNames.map(name => {
        const type = Services.prefs.getPrefType(name);
        let value = null;
        if (type === Ci.nsIPrefBranch.PREF_BOOL) {
          value = Services.prefs.getBoolPref(name);
        } else if (type === Ci.nsIPrefBranch.PREF_INT) {
          value = Services.prefs.getIntPref(name);
        } else if (type === Ci.nsIPrefBranch.PREF_STRING) {
          value = Services.prefs.getCharPref(name);
        }
        return {
          hadUserValue: Services.prefs.prefHasUserValue(name),
          name,
          type,
          value,
        };
      });
      const { BrowserToolboxLauncher } = ChromeUtils.importESModule(
        "resource://devtools/client/framework/browser-toolbox/Launcher.sys.mjs"
      );
      if (BrowserToolboxLauncher.getBrowserToolboxSessionState()) {
        throw new Error("FENNEVIA_BROWSER_TOOLBOX_SESSION_ALREADY_ACTIVE");
      }
      const debuggerProfile = Services.dirsvc.get("ProfD", Ci.nsIFile);
      debuggerProfile.append("chrome_debugger_profile");
      if (!debuggerProfile.exists()) {
        debuggerProfile.create(Ci.nsIFile.DIRECTORY_TYPE, 0o755);
      }
      const debuggerPrefs = debuggerProfile.clone();
      debuggerPrefs.append("prefs.js");
      const debuggerPrefsBackup = debuggerProfile.clone();
      debuggerPrefsBackup.append("prefs.js.fennevia-probe-backup");
      const debuggerProfileMarker = debuggerProfile.clone();
      debuggerProfileMarker.append(".fennevia-browser-toolbox-probe");
      if (debuggerPrefsBackup.exists() || debuggerProfileMarker.exists()) {
        throw new Error("FENNEVIA_BROWSER_TOOLBOX_STALE_PROFILE_STATE");
      }
      const originalDebuggerPrefsExisted = debuggerPrefs.exists();
      const debuggerProfileState = {
        backup: debuggerPrefsBackup,
        directory: debuggerProfile,
        marker: debuggerProfileMarker,
        originalPrefsExisted: originalDebuggerPrefsExisted,
        prepared: false,
        prefs: debuggerPrefs,
      };
      const probe = {
        debuggerProfileState,
        launcher: null,
        preferences,
      };
      Object.defineProperty(window, propertyName, {
        configurable: true,
        value: probe,
      });
      if (originalDebuggerPrefsExisted) {
        debuggerPrefs.copyTo(
          debuggerProfile,
          debuggerPrefsBackup.leafName
        );
      }
      debuggerProfileMarker.create(Ci.nsIFile.NORMAL_FILE_TYPE, 0o600);
      debuggerProfileState.prepared = true;

      Services.prefs.setBoolPref(
        "devtools.browsertoolbox.enable-test-server",
        true
      );
      Services.prefs.setCharPref("devtools.browsertoolbox.panel", "inspector");
      Services.prefs.setCharPref("devtools.browsertoolbox.scope", "everything");
      Services.prefs.setBoolPref(
        "devtools.debugger.prompt-connection",
        false
      );
      try {
        Services.prefs.savePrefFile(debuggerPrefs);
      } finally {
        Services.prefs.setBoolPref(
          "devtools.debugger.prompt-connection",
          true
        );
      }
      return new Promise((resolve, reject) => {
        const timeout = window.setTimeout(
          () => reject(new Error("FENNEVIA_BROWSER_TOOLBOX_LAUNCH_TIMEOUT")),
          30000
        );
        const launcher = BrowserToolboxLauncher.init({
          forceMultiprocess: true,
          overwritePreferences: false,
          onRun() {
            window.clearTimeout(timeout);
            resolve({
              promptConnectionEnabled: Services.prefs.getBoolPref(
                "devtools.debugger.prompt-connection",
                false
              ),
              sessionActive:
                BrowserToolboxLauncher.getBrowserToolboxSessionState(),
            });
          },
        });
        probe.launcher = launcher;
        if (!launcher) {
          window.clearTimeout(timeout);
          reject(new Error("FENNEVIA_BROWSER_TOOLBOX_LAUNCH_UNAVAILABLE"));
        }
      });
    `,
      BROWSER_TOOLBOX_TIMEOUT_MS,
    );
    assert.deepEqual(launchState, {
      promptConnectionEnabled: true,
      sessionActive: true,
    });
    assert.equal(await acceptBrowserToolboxConnectionPrompt(client), true);

    const inspectorExpression = `(async () => {
      const XHTML_NS = "http://www.w3.org/1999/xhtml";
      const SVG_NS = "http://www.w3.org/2000/svg";
      const inspector = await gToolbox.selectTool("inspector");
      const walker = inspector.walker;
      const rootNode = await walker.getRootNode();
      const query = selector => walker.querySelector(rootNode, selector);
      const [browser, toolbox, tabbox, frame, top, left, right, bottom, overlay] =
        await Promise.all([
          query("#browser"),
          query("#navigator-toolbox"),
          query("#tabbrowser-tabbox"),
          query("#fennevia-shell-frame-host"),
          query("#fennevia-shell-top-host"),
          query("#fennevia-shell-left-host"),
          query("#fennevia-shell-right-host"),
          query("#fennevia-shell-bottom-host"),
          query("#fennevia-shell-address-overlay-host"),
        ]);
      const hosts = [frame, top, left, right, bottom, overlay];
      const nativeNodes = [browser, toolbox, tabbox];
      if ([...hosts, ...nativeNodes].some(node => !node)) {
        return JSON.stringify({ error: "FENNEVIA_HOST_OR_NATIVE_NODE_MISSING" });
      }

      const projectElements = [];
      let nativeAnonymousElementCount = 0;
      for (const host of [frame]) {
        const pending = [host];
        while (pending.length > 0) {
          const node = pending.shift();
          if (node.isNativeAnonymous) {
            if (node.nodeType === 1) {
              nativeAnonymousElementCount += 1;
            }
            continue;
          }
          if (node.nodeType === 1) {
            projectElements.push(node);
          }
          const response = await walker.children(node);
          pending.push(...response.nodes);
        }
      }
      const nativeOutsideHosts = nativeNodes.every(node => {
        for (let ancestor = node; ancestor; ancestor = ancestor.parentNode()) {
          if (hosts.includes(ancestor)) {
            return false;
          }
        }
        return true;
      });
      const hasAllowedProjectNamespace = node => {
        if (node.namespaceURI === XHTML_NS) {
          return true;
        }
        if (node.namespaceURI !== SVG_NS) {
          return false;
        }
        for (let ancestor = node; ancestor; ancestor = ancestor.parentNode()) {
          if (
            ancestor.namespaceURI === SVG_NS &&
            ancestor.nodeName.toLowerCase() === "svg" &&
            ancestor.getAttribute("data-fennevia-icon") != null
          ) {
            return true;
          }
          if (ancestor.namespaceURI === XHTML_NS) {
            return false;
          }
        }
        return false;
      };

      inspector.selection.setNodeFront(frame, {
        reason: "fennevia-ownership-probe",
      });

      return JSON.stringify({
        hostCount: hosts.length,
        namespaceComplete: projectElements.every(
          hasAllowedProjectNamespace
        ),
        namespaceMismatches: projectElements
          .filter(node => !hasAllowedProjectNamespace(node))
          .map(node => ({
            isAnonymous: Boolean(node.isAnonymous),
            isNativeAnonymous: Boolean(node.isNativeAnonymous),
            name: node.nodeName,
            namespace: node.namespaceURI,
          })),
        nativeAnonymousElementCount,
        nativeOutsideHosts,
        ownedHostsAreInFrame: [top, left, right, bottom, overlay].every(
          host => host.parentNode() === frame
        ),
        frameParentIsBrowser: frame.parentNode() === browser,
        projectElementCount: projectElements.length,
        selectedHostId: inspector.selection.nodeFront.id,
        toolId: gToolbox.currentToolId,
      });
    })()`;

    const inspectorResult = await client.execute(
      `
      return (async () => {
        const { require } = ChromeUtils.importESModule(
          "resource://devtools/shared/loader/Loader.sys.mjs"
        );
        const {
          DevToolsClient,
        } = require("resource://devtools/client/devtools-client.js");
        const {
          CommandsFactory,
        } = require("resource://devtools/shared/commands/commands-factory.js");
        let transport;
        const deadline = Date.now() + 15000;
        while (!transport && Date.now() < deadline) {
          try {
            transport = await DevToolsClient.socketConnect({
              host: "localhost",
              port: 6001,
              webSocket: false,
            });
          } catch {
            await new Promise(resolve => window.setTimeout(resolve, 100));
          }
        }
        if (!transport) {
          throw new Error("FENNEVIA_BROWSER_TOOLBOX_TEST_SERVER_TIMEOUT");
        }

        const devToolsClient = new DevToolsClient(transport);
        let commands;
        try {
          await devToolsClient.connect();
          commands = await CommandsFactory.forMainProcess({
            client: devToolsClient,
          });
          const target = await commands.descriptorFront.getTarget();
          const consoleFront = await target.getFront("console");
          const evaluate = async expression => {
            const resultPromise = consoleFront.once("evaluationResult");
            await consoleFront.evaluateJSAsync({
              text: expression,
              mapped: { await: true },
            });
            const result = await resultPromise;
            if (
              result.exceptionMessage ||
              result.hasException ||
              result.topLevelAwaitRejected
            ) {
              throw new Error("FENNEVIA_BROWSER_TOOLBOX_EVALUATION_FAILED");
            }
            return result.result;
          };
          const serializedOwnership = await evaluate(
            ${JSON.stringify(inspectorExpression)}
          );
          const ownership = JSON.parse(serializedOwnership);
          consoleFront
            .evaluateJSAsync({ text: "gToolbox.destroy()" })
            .catch(() => {});
          return ownership;
        } finally {
          try {
            await Promise.race([
              commands?.destroy(),
              new Promise(resolve => window.setTimeout(resolve, 2000)),
            ]);
          } catch {
            // The Browser Toolbox process may already have closed its connection.
          }
          try {
            await Promise.race([
              devToolsClient.close(),
              new Promise(resolve => window.setTimeout(resolve, 2000)),
            ]);
          } catch {
            // Closing an already-closed diagnostic connection is harmless.
          }
        }
      })();
    `,
      BROWSER_TOOLBOX_TIMEOUT_MS,
    );

    assert.equal(inspectorResult.error, undefined);
    if (!inspectorResult.namespaceComplete) {
      console.error(
        `browserToolboxNamespaceDiagnostics=${JSON.stringify(
          inspectorResult.namespaceMismatches,
        )}`,
      );
    }
    assert.equal(inspectorResult.hostCount, 6);
    assert.equal(inspectorResult.namespaceComplete, true);
    assert.equal(inspectorResult.nativeOutsideHosts, true);
    assert.equal(inspectorResult.ownedHostsAreInFrame, true);
    assert.equal(inspectorResult.frameParentIsBrowser, true);
    assert.ok(inspectorResult.projectElementCount >= 30);
    assert.equal(inspectorResult.selectedHostId, "fennevia-shell-frame-host");
    assert.equal(inspectorResult.toolId, "inspector");
    return inspectorResult;
  } finally {
    if (launchAttempted) {
      const cleanupState = await cleanupBrowserToolboxProbe(client);
      assert.deepEqual(cleanupState, {
        promptConnectionEnabled: true,
        sessionActive: false,
        testPropertyRemoved: true,
      });
    }
  }
}

const EXPECTED_NATIVE_STATE = Object.freeze({
  active: false,
  documentUri: "chrome://browser/content/browser.xhtml",
  mainWindowId: "main-window",
  nativeToolboxPresent: true,
  windowType: "navigator:browser",
});

const EXPECTED_ACTIVE_NATIVE_STATE = Object.freeze({
  ...EXPECTED_NATIVE_STATE,
  active: true,
});

function countEvent(evidence, event, windowKind) {
  return evidence.records.filter(
    (record) =>
      record.event === event &&
      (windowKind === undefined || record.windowKind === windowKind),
  ).length;
}

async function waitForProcessExit(child, timeoutMs) {
  if (child.exitCode !== null) {
    return child.exitCode;
  }
  return Promise.race([
    new Promise((resolve) => child.once("exit", resolve)),
    new Promise((resolve, reject) =>
      setTimeout(
        () => reject(new Error("FENNEVIA_FIREFOX_TEST_PROCESS_EXIT_TIMEOUT")),
        timeoutMs,
      ),
    ),
  ]);
}

async function run() {
  const options = parseArguments(process.argv.slice(2));
  const sessionRestoreFailOpen = options.sessionRestore === "fail-open";
  await validateTarget(
    options.firefox,
    options.profile,
    options.expectFailOpen,
    options.expectStock || options.inspectDom,
    options.expectDisabled,
    options.expectSafeStart,
    options.expectShellFailOpen,
    options.expectShellMissingFailOpen || sessionRestoreFailOpen,
  );
  const sessionRestoreState = options.sessionRestore
    ? await readSessionRestoreState(
        options.profile,
        options.sessionRestore !== "prepare",
      )
    : null;
  await assertPortAvailable(DEFAULT_PORT);

  const launchStartedAt = Date.now();
  const launchArguments = [
    "--marionette",
    "--remote-allow-system-access",
    "--no-remote",
    "--new-instance",
    "--profile",
    options.profile,
  ];
  if (
    options.sessionRestore !== "verify" &&
    options.sessionRestore !== "fail-open"
  ) {
    launchArguments.push("--new-window", "about:blank");
  }
  const child = spawn(options.firefox, launchArguments, {
    env: process.env,
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: false,
  });
  for (const stream of [child.stdout, child.stderr]) {
    stream.resume();
  }

  let client;
  let quitRequested = false;
  try {
    client = await connectWithRetry(DEFAULT_PORT, child);
    const session = await client.request("WebDriver:NewSession", {
      strictFileInteractability: true,
    });
    assert.equal(typeof session?.sessionId, "string");
    await client.request("WebDriver:SetTimeouts", {
      script: URLBAR_COVERAGE_MATRIX_TIMEOUT_MS,
    });
    await client.request("Marionette:SetContext", { value: "chrome" });

    const originalHandle = (await client.request("WebDriver:GetWindowHandle"))
      .value;
    assert.equal(typeof originalHandle, "string");

    if (options.sessionRestore) {
      let sessionEvidence = await executeSessionRestoreMode(
        client,
        options.sessionRestore,
        sessionRestoreState,
      );
      await client.request("Marionette:AcceptConnections", { value: false });
      quitRequested = true;
      try {
        await client.request("Marionette:Quit", {});
      } catch {
        // A clean application quit may close Marionette before its response arrives.
      }
      await waitForProcessExit(child, PROCESS_EXIT_TIMEOUT_MS);
      if (options.sessionRestore === "cleanup") {
        await unlink(sessionRestoreState.statePath);
        sessionEvidence = assertPrivacySafeSessionRestoreEvidence({
          ...sessionEvidence,
          stateRemoved: true,
        });
      }
      console.log(`sessionRestoreEvidence=${JSON.stringify(sessionEvidence)}`);
      console.log(
        options.sessionRestore === "prepare"
          ? "PASS: fixed synthetic tabs were prepared and persisted through a clean Firefox shutdown."
          : options.sessionRestore === "verify"
            ? "PASS: a new Firefox process restored native and Fennevia tab state while leaving background tabs pending."
            : options.sessionRestore === "fail-open"
              ? "PASS: restored native tabs remained usable while a missing frontend removed every project host."
              : "PASS: the session rehearsal restored preferences, one blank tab, and removed its test state.",
      );
      return;
    }

    if (options.inspectDom) {
      await new Promise((resolve) => setTimeout(resolve, 750));
      const snapshot = await collectBrowserDomSnapshot(client);
      assert.equal(
        snapshot.documentUri,
        "chrome://browser/content/browser.xhtml",
      );
      assert.equal(snapshot.root.localName, "html");
      assert.equal(snapshot.root.id, "main-window");
      assert.equal(snapshot.root.namespaceURI, snapshot.xhtmlNamespace);
      assert.equal(snapshot.body.localName, "body");
      assert.equal(snapshot.body.namespaceURI, snapshot.xhtmlNamespace);

      const bySelector = Object.fromEntries(
        snapshot.elements.map((element) => [element.selector, element]),
      );
      for (const selector of [
        "#navigator-toolbox",
        "#browser",
        "#sidebar-container",
        "#sidebar-box",
        "#tabbrowser-tabbox",
        "#window-modal-dialog",
      ]) {
        assert.equal(bySelector[selector].exists, true);
      }
      assert.equal(bySelector["#navigator-toolbox"].parentLocalName, "body");
      assert.equal(bySelector["#browser"].parentLocalName, "body");
      for (const selector of [
        "#sidebar-container",
        "#sidebar-launcher-splitter",
        "#sidebar-box",
        "#sidebar-splitter",
        "#tabbrowser-tabbox",
      ]) {
        assert.equal(bySelector[selector].parentId, "browser");
      }
      assert.ok(
        snapshot.bodyOrder.navigatorToolbox < snapshot.bodyOrder.browser,
      );
      assert.ok(
        snapshot.bodyOrder.browser < snapshot.bodyOrder.fullscreenToggler,
      );
      assert.equal(snapshot.projectHostCount, 0);

      await client.request("Marionette:AcceptConnections", { value: false });
      quitRequested = true;
      try {
        await client.request("Marionette:Quit", {});
      } catch {
        // A clean application quit may close Marionette before its response arrives.
      }
      await waitForProcessExit(child, PROCESS_EXIT_TIMEOUT_MS);
      console.log(
        `PASS: stock browser DOM snapshot ${JSON.stringify(snapshot)}`,
      );
      return;
    }

    if (options.expectStock) {
      await new Promise((resolve) => setTimeout(resolve, 750));
      assert.deepEqual(await collectNativeState(client), EXPECTED_NATIVE_STATE);
      const evidence = await collectEvidence(client);
      assert.equal(evidence.records.length, 0);
      assert.equal(evidence.firstPartyScriptErrorCount, 0);

      await client.request("Marionette:AcceptConnections", { value: false });
      quitRequested = true;
      try {
        await client.request("Marionette:Quit", {});
      } catch {
        // A clean application quit may close Marionette before its response arrives.
      }
      await waitForProcessExit(child, PROCESS_EXIT_TIMEOUT_MS);
      console.log(
        "PASS: uninstalled stock startup retained native browser UI with zero " +
          "Fennevia records or owned-file residue.",
      );
      return;
    }

    if (options.expectDisabled) {
      await new Promise((resolve) => setTimeout(resolve, 750));
      assert.deepEqual(await collectNativeState(client), EXPECTED_NATIVE_STATE);
      const evidence = await collectEvidence(client);
      assert.equal(evidence.records.length, 0);
      assert.equal(evidence.firstPartyScriptErrorCount, 0);
      assert.equal(
        await client.execute(`
          return document.querySelectorAll('[data-fennevia-shell-frame]').length;
        `),
        0,
      );

      await client.request("Marionette:AcceptConnections", { value: false });
      quitRequested = true;
      try {
        await client.request("Marionette:Quit", {});
      } catch {
        // A clean application quit may close Marionette before its response arrives.
      }
      await waitForProcessExit(child, PROCESS_EXIT_TIMEOUT_MS);
      console.log(
        "PASS: hard-disabled startup retained native browser UI with zero " +
          "Fennevia records or project hosts.",
      );
      return;
    }

    if (options.expectFailOpen) {
      await new Promise((resolve) => setTimeout(resolve, 750));
      assert.deepEqual(await collectNativeState(client), EXPECTED_NATIVE_STATE);
      const evidence = await collectEvidence(client);
      const fatalRecords = evidence.records.filter(
        (record) => record.event === "bootstrap.fatal",
      );
      assert.equal(fatalRecords.length, 1);
      assert.equal(fatalRecords[0].phase, "entry-import");
      assert.equal(fatalRecords[0].code, "FENNEVIA_BOOTSTRAP_FATAL");
      assert.equal(countEvent(evidence, "bootstrap.success"), 0);
      assert.equal(countEvent(evidence, "runtime.started"), 0);
      assert.equal(countEvent(evidence, "window.initialized"), 0);
      assert.equal(evidence.firstPartyScriptErrorCount, 0);

      await client.request("Marionette:AcceptConnections", { value: false });
      quitRequested = true;
      try {
        await client.request("Marionette:Quit", {});
      } catch {
        // A clean application quit may close Marionette before its response arrives.
      }
      await waitForProcessExit(child, PROCESS_EXIT_TIMEOUT_MS);
      console.log(
        "PASS: missing privileged dependency failed open with one caught bootstrap " +
          "fatal record while native browser UI remained available.",
      );
      return;
    }

    if (
      options.expectShellFailOpen ||
      options.expectShellMissingFailOpen ||
      options.expectBridgeFailOpen ||
      options.expectBookmarksBridgeFailOpen ||
      options.expectDownloadsBridgeFailOpen ||
      options.expectNavigationBridgeFailOpen ||
      options.expectUrlbarCoverageBridgeFailOpen ||
      options.expectTabsBridgeFailOpen
    ) {
      await new Promise((resolve) => setTimeout(resolve, 750));
      assert.deepEqual(await collectNativeState(client), EXPECTED_NATIVE_STATE);
      await assertNoShellHosts(client);
      const runtimeState = await client.execute(`
        const { startProcessRuntime } = ChromeUtils.importESModule(
          "chrome://fennevia/content/runtime/Runtime.sys.mjs"
        );
        return startProcessRuntime({
          createWindowManager() {
            throw new Error("FENNEVIA_RUNTIME_STATE_MISSING");
          },
        }).runtime.snapshot();
      `);
      assert.deepEqual(runtimeState, {
        initializationCount: 1,
        initializingWindowCount: 0,
        managedWindowCount: 0,
        state: "started",
      });

      const evidence = await collectEvidence(client);
      assert.equal(countEvent(evidence, "bootstrap.success"), 1);
      assert.equal(countEvent(evidence, "bootstrap.fatal"), 0);
      assert.equal(countEvent(evidence, "runtime.started"), 1);
      assert.equal(countEvent(evidence, "window.initialized"), 0);
      assert.equal(countEvent(evidence, "window.initialization-failed"), 1);
      assert.equal(countEvent(evidence, "window.disposed", "normal"), 1);
      assert.equal(countEvent(evidence, "shell.hosts-ready", "normal"), 1);
      assert.equal(countEvent(evidence, "shell.hosts-disposed", "normal"), 1);
      if (
        options.expectBridgeFailOpen ||
        options.expectBookmarksBridgeFailOpen ||
        options.expectDownloadsBridgeFailOpen ||
        options.expectNavigationBridgeFailOpen ||
        options.expectUrlbarCoverageBridgeFailOpen ||
        options.expectTabsBridgeFailOpen
      ) {
        assert.equal(
          countEvent(evidence, "bridge.boundary-created", "normal"),
          1,
        );
        assert.equal(
          countEvent(evidence, "bridge.boundary-ready", "normal"),
          0,
        );
        assert.equal(
          countEvent(evidence, "bridge.boundary-disposed", "normal"),
          1,
        );
      }
      const shellFailures = evidence.records.filter(
        (record) => record.event === "shell.lifecycle-failed",
      );
      assert.equal(shellFailures.length, 1);
      const expectedShellFailure = options.expectUrlbarCoverageBridgeFailOpen
        ? {
            code: "FENNEVIA_FIREFOX_URLBAR_COVERAGE_CAPABILITY_MISSING",
            phase: "firefox-urlbar-coverage-capability",
          }
        : options.expectNavigationBridgeFailOpen
          ? {
              code: "FENNEVIA_FIREFOX_NAVIGATION_CAPABILITY_MISSING",
              phase: "firefox-navigation-capability",
            }
          : options.expectBookmarksBridgeFailOpen
            ? {
                code: "FENNEVIA_FIREFOX_BOOKMARKS_CAPABILITY_MISSING",
                phase: "firefox-bookmarks-capability",
              }
            : options.expectDownloadsBridgeFailOpen
              ? {
                  code: "FENNEVIA_FIREFOX_DOWNLOADS_CAPABILITY_MISSING",
                  phase: "firefox-downloads-capability",
                }
              : options.expectTabsBridgeFailOpen
                ? {
                    code: "FENNEVIA_FIREFOX_TABS_CAPABILITY_MISSING",
                    phase: "firefox-tabs-capability",
                  }
                : options.expectBridgeFailOpen
                  ? {
                      code: "FENNEVIA_FIREFOX_CAPABILITY_MISSING",
                      phase: "firefox-bridge-capability",
                    }
                  : options.expectShellMissingFailOpen
                    ? {
                        code: "FENNEVIA_FRONTEND_SCRIPT_LOAD_FAILED",
                        phase: "shell-frontend-load",
                      }
                    : {
                        code: "FENNEVIA_TEST_FRONTEND_MOUNT_FAILED",
                        phase: "shell-frontend-mount",
                      };
      assert.equal(shellFailures[0].code, expectedShellFailure.code);
      assert.equal(shellFailures[0].phase, expectedShellFailure.phase);
      assert.equal(shellFailures[0].windowKind, "normal");
      assert.equal(
        shellFailures[0].firefoxSymbol,
        options.expectUrlbarCoverageBridgeFailOpen
          ? "window.openLocation"
          : options.expectNavigationBridgeFailOpen
            ? "window.gBrowser.removeTabsProgressListener"
            : options.expectBookmarksBridgeFailOpen
              ? "PlacesUtils.bookmarks.fetch"
              : options.expectDownloadsBridgeFailOpen
                ? "DownloadList.addView"
                : options.expectTabsBridgeFailOpen
                  ? "window.gBrowser.openTabs"
                  : options.expectBridgeFailOpen
                    ? "window.gBrowser"
                    : undefined,
      );
      assert.ok(Array.isArray(shellFailures[0].stack));
      assert.ok(
        shellFailures[0].stack.some((line) =>
          line.includes("chrome://fennevia/"),
        ),
      );
      assert.equal(evidence.firstPartyScriptErrorCount, 0);

      await client.request("Marionette:AcceptConnections", { value: false });
      quitRequested = true;
      try {
        await client.request("Marionette:Quit", {});
      } catch {
        // A clean application quit may close Marionette before its response arrives.
      }
      await waitForProcessExit(child, PROCESS_EXIT_TIMEOUT_MS);
      console.log(
        `PASS: a ${options.expectUrlbarCoverageBridgeFailOpen ? "missing required Urlbar coverage capability" : options.expectNavigationBridgeFailOpen ? "missing required navigation capability" : options.expectBookmarksBridgeFailOpen ? "missing required bookmarks capability" : options.expectDownloadsBridgeFailOpen ? "missing required downloads capability" : options.expectTabsBridgeFailOpen ? "missing required tabs capability" : options.expectBridgeFailOpen ? "missing required bridge capability" : options.expectShellMissingFailOpen ? "missing frontend bundle" : "throwing frontend bundle"} followed the per-window fail-open ` +
          "path, removed every project host, and retained native browser UI.",
      );
      return;
    }

    if (options.expectSafeStart) {
      await new Promise((resolve) => setTimeout(resolve, 750));
      assert.deepEqual(await collectNativeState(client), EXPECTED_NATIVE_STATE);
      await assertNoShellHosts(client);
      const evidence = await collectEvidence(client);
      const skippedRecords = evidence.records.filter(
        (record) => record.event === "bootstrap.skipped",
      );
      assert.equal(skippedRecords.length, 1);
      assert.equal(skippedRecords[0].phase, "preflight");
      assert.equal(skippedRecords[0].result, "safe-start");
      assert.equal(skippedRecords[0].code, "FENNEVIA_BOOTSTRAP_SAFE_START");
      assert.equal(countEvent(evidence, "bootstrap.success"), 0);
      assert.equal(countEvent(evidence, "bootstrap.fatal"), 0);
      assert.equal(countEvent(evidence, "runtime.started"), 0);
      assert.equal(countEvent(evidence, "window.initialized"), 0);
      assert.equal(countEvent(evidence, "shell.hosts-ready"), 0);
      assert.equal(evidence.firstPartyScriptErrorCount, 0);

      await client.request("Marionette:AcceptConnections", { value: false });
      quitRequested = true;
      try {
        await client.request("Marionette:Quit", {});
      } catch {
        // A clean application quit may close Marionette before its response arrives.
      }
      await waitForProcessExit(child, PROCESS_EXIT_TIMEOUT_MS);
      console.log(
        "PASS: safe start exited before package loading and retained native browser UI.",
      );
      return;
    }

    let initialState;
    try {
      initialState = await waitForState(
        client,
        (state) =>
          state?.state === "started" &&
          state.initializationCount === 1 &&
          state.managedWindowCount === 1,
        "FENNEVIA_FIREFOX_TEST_INITIAL_STATE_TIMEOUT",
      );
    } catch (error) {
      const diagnosticEvidence = await collectEvidence(client);
      console.error(
        `startupDiagnostics=${JSON.stringify(
          diagnosticEvidence.records.map((record) => ({
            code: record.code,
            errorName: record.errorName,
            event: record.event,
            phase: record.phase,
            shellState: record.shellState,
            stack: record.stack,
            firefoxSymbol: record.firefoxSymbol,
            windowKind: record.windowKind,
          })),
        )}`,
      );
      throw error;
    }
    assert.equal(initialState.initializingWindowCount, 0);
    const startupEvidence = await collectEvidence(client);
    assert.equal(countEvent(startupEvidence, "bootstrap.success"), 1);
    assert.equal(countEvent(startupEvidence, "runtime.started"), 1);
    assert.equal(
      countEvent(startupEvidence, "window.initialized", "normal"),
      1,
    );
    assert.equal(countEvent(startupEvidence, "shell.hosts-ready", "normal"), 1);
    assert.equal(
      countEvent(startupEvidence, "bridge.boundary-created", "normal"),
      1,
    );
    assert.equal(
      countEvent(startupEvidence, "bridge.boundary-ready", "normal"),
      1,
    );
    assert.equal(startupEvidence.firstPartyScriptErrorCount, 0);

    if (options.performanceBaseline) {
      assert.deepEqual(
        await collectNativeState(client),
        EXPECTED_ACTIVE_NATIVE_STATE,
      );
      assertShellHostState(await collectShellHostState(client), "normal");
      assertFrontendState(await collectFrontendState(client), "normal");
      const baseline = await collectPerformanceBaseline(
        client,
        originalHandle,
        Date.now() - launchStartedAt,
      );
      assertShellHostState(await collectShellHostState(client), "normal");
      assertFrontendState(await collectFrontendState(client), "normal");

      await client.request("Marionette:AcceptConnections", { value: false });
      quitRequested = true;
      try {
        await client.request("Marionette:Quit", {});
      } catch {
        // A clean application quit may close Marionette before its response arrives.
      }
      await waitForProcessExit(child, PROCESS_EXIT_TIMEOUT_MS);
      console.log(`performanceBaseline=${JSON.stringify(baseline)}`);
      console.log(
        "PASS: Firefox startup, five-second idle resources, edge reveal response, " +
          "and five complete window lifecycle cycles produced a privacy-safe baseline.",
      );
      return;
    }

    assert.deepEqual(
      await collectNativeState(client),
      EXPECTED_ACTIVE_NATIVE_STATE,
    );
    assertShellHostState(await collectShellHostState(client), "normal");
    assertFrontendState(await collectFrontendState(client), "normal");
    assertEdgeShellInteraction(await exerciseEdgeShell(client));
    assertFrontendState(await collectFrontendState(client), "normal");
    assertNativeUiPolicies(await exerciseNativeUiPolicies(client));
    assertShellHostState(await collectShellHostState(client), "normal");
    assertFrontendState(await collectFrontendState(client), "normal");
    assert.deepEqual(await exerciseWindowStatePolicy(client), {
      maximized: true,
      minimized: true,
      resized: true,
      restored: true,
    });
    assertShellHostState(await collectShellHostState(client), "normal");
    await assertNativeModalUnobstructed(client);
    if (options.browserToolbox) {
      await runBrowserToolboxOwnershipProbe(client);
      assertShellHostState(await collectShellHostState(client), "normal");
      assertFrontendState(await collectFrontendState(client), "normal");
    }
    await assertNativeStylesIsolated(client);
    assertNavigationControls(await exerciseNavigationControls(client));
    assertFrontendState(await collectFrontendState(client), "normal");
    assertAddressInput(await exerciseAddressInput(client));
    assertFrontendState(await collectFrontendState(client), "normal");
    assertUrlbarCoverageMatrix(await exerciseUrlbarCoverageMatrix(client));
    assertFrontendState(await collectFrontendState(client), "normal");
    assertTabStripMvp(await exerciseTabStripMvp(client));
    assertFrontendState(await collectFrontendState(client), "normal");
    assertBookmarksMvp(await exerciseBookmarksMvp(client));
    assertFrontendState(await collectFrontendState(client), "normal");
    assertDownloadsMvp(await exerciseDownloadsMvp(client), "normal");
    assertFrontendState(await collectFrontendState(client), "normal");
    const featureEvidence = await collectEvidence(client);
    assert.equal(
      featureEvidence.records.filter((record) => record.level === "error")
        .length,
      0,
    );
    assert.equal(featureEvidence.firstPartyScriptErrorCount, 0);

    const tabResult = await client.request("WebDriver:NewWindow", {
      focus: false,
      type: "tab",
    });
    const tabWindow = tabResult.value ?? tabResult;
    assert.equal(tabWindow.type, "tab");
    await waitForFrontendTabCount(client, 2);
    await new Promise((resolve) => setTimeout(resolve, 250));
    assert.equal(
      (
        await waitForState(
          client,
          (state) => state?.managedWindowCount === 1,
          "FENNEVIA_FIREFOX_TEST_TAB_EXCLUSION_TIMEOUT",
        )
      ).managedWindowCount,
      1,
    );
    await client.request("WebDriver:SwitchToWindow", {
      handle: tabWindow.handle,
    });
    await client.request("WebDriver:CloseWindow");
    await client.request("WebDriver:SwitchToWindow", {
      handle: originalHandle,
    });
    await client.request("Marionette:SetContext", { value: "chrome" });
    await waitForFrontendTabCount(client, 1);

    const secondWindowResult = await client.request("WebDriver:NewWindow", {
      focus: true,
      private: false,
      type: "window",
    });
    const secondWindow = secondWindowResult.value ?? secondWindowResult;
    assert.equal(secondWindow.type, "window");
    await waitForState(
      client,
      (state) => state?.managedWindowCount === 2,
      "FENNEVIA_FIREFOX_TEST_SECOND_WINDOW_TIMEOUT",
    );
    let evidence = await collectEvidence(client);
    assert.ok(countEvent(evidence, "window.initialized", "normal") >= 1);
    assert.ok(countEvent(evidence, "shell.hosts-ready", "normal") >= 1);
    assert.ok(countEvent(evidence, "bridge.boundary-created", "normal") >= 1);
    assert.ok(countEvent(evidence, "bridge.boundary-ready", "normal") >= 1);

    await client.request("WebDriver:SwitchToWindow", {
      handle: secondWindow.handle,
    });
    await client.request("Marionette:SetContext", { value: "chrome" });
    assertShellHostState(await collectShellHostState(client), "normal");
    assertFrontendState(await collectFrontendState(client), "normal");
    assertEdgeShellInteraction(await exerciseEdgeShell(client));
    assertDownloadsMvp(await exerciseDownloadsMvp(client), "normal");
    assertFrontendState(await collectFrontendState(client), "normal");
    await client.execute(`
      gBrowser.addTrustedTab(BROWSER_NEW_TAB_URL, { inBackground: true });
    `);
    await waitForFrontendTabCount(client, 2);
    await client.request("WebDriver:SwitchToWindow", {
      handle: originalHandle,
    });
    await client.request("Marionette:SetContext", { value: "chrome" });
    await waitForFrontendTabCount(client, 1);
    await client.request("WebDriver:SwitchToWindow", {
      handle: secondWindow.handle,
    });
    await client.request("Marionette:SetContext", { value: "chrome" });
    await client.execute(`
      gBrowser.removeTab(gBrowser.openTabs.at(-1), {
        animate: false,
        isUserTriggered: true,
      });
    `);
    await waitForFrontendTabCount(client, 1);
    await client.request("WebDriver:SwitchToWindow", {
      handle: originalHandle,
    });
    await client.request("Marionette:SetContext", { value: "chrome" });
    assertFrontendState(await collectFrontendState(client), "normal");
    await client.request("WebDriver:SwitchToWindow", {
      handle: secondWindow.handle,
    });
    await client.request("Marionette:SetContext", { value: "chrome" });
    assert.deepEqual(await exerciseEmergencyFallback(client), {
      active: false,
      hostCount: 0,
      nativeBrowserPresent: true,
      nativeToolboxPresent: true,
      rootState: null,
    });
    await assertNoShellHosts(client);
    const remount = await exerciseFrontendUnmountRemount(client);
    assert.equal(remount.bookmarkSubscriptionCount, 2);
    assert.equal(remount.bookmarkUnsubscriptionCount, 2);
    assert.equal(remount.descendantsAfterFirstDispose, 0);
    assert.equal(remount.descendantsAfterSecondDispose, 0);
    assert.equal(remount.downloadSubscriptionCount, 2);
    assert.equal(remount.downloadUnsubscriptionCount, 2);
    assert.equal(remount.fatalErrorCount, 0);
    assert.equal(remount.firstDisposeResult, true);
    assert.equal(remount.firstFaviconErrorCleared, true);
    assert.equal(remount.firstFaviconSourceCleared, true);
    assert.equal(remount.firstRootCount, 5);
    assert.equal(remount.firstRootsDisconnected, true);
    assert.equal(remount.firstStatusesDisposed, true);
    assert.equal(remount.frameReadyAfterDispose, false);
    assert.ok(remount.listenerAddCount >= 4);
    const listenerDiagnostics = JSON.stringify({
      add: remount.listenerAddCount,
      outstanding: remount.listenerOutstandingCount,
      outstandingTypes: remount.listenerOutstandingTypes,
      remove: remount.listenerRemoveCount,
    });
    if (remount.listenerOutstandingCount !== 0) {
      console.error(`frontendListenerDiagnostics=${listenerDiagnostics}`);
    }
    assert.equal(
      remount.listenerOutstandingCount,
      0,
      `frontendListenerDiagnostics=${listenerDiagnostics}`,
    );
    assert.equal(
      remount.listenerRemoveCount,
      remount.listenerAddCount,
      `frontendListenerDiagnostics=${listenerDiagnostics}`,
    );
    assert.equal(remount.navigationSubscriptionCount, 2);
    assert.equal(remount.navigationUnsubscriptionCount, 2);
    assert.equal(remount.addressPopupSubscriptionCount, 2);
    assert.equal(remount.addressPopupUnsubscriptionCount, 2);
    assert.equal(remount.registrationCallbackPresent, false);
    assert.equal(remount.secondDisposeResult, true);
    assert.equal(remount.secondRootCount, 5);
    assert.equal(remount.secondRootsAreNew, true);
    assert.equal(remount.secondStatusesDisposed, true);
    assert.equal(remount.tabSubscriptionCount, 2);
    assert.equal(remount.tabUnsubscriptionCount, 2);
    assert.equal(remount.urlbarCoverageSubscriptionCount, 2);
    assert.equal(remount.urlbarCoverageUnsubscriptionCount, 2);
    assert.equal(remount.unmountErrorCount, 0);
    await client.request("WebDriver:SwitchToWindow", {
      handle: originalHandle,
    });
    await client.request("Marionette:SetContext", { value: "chrome" });
    assertShellHostState(await collectShellHostState(client), "normal");
    assertFrontendState(await collectFrontendState(client), "normal");
    await client.request("WebDriver:SwitchToWindow", {
      handle: secondWindow.handle,
    });
    await client.request("Marionette:SetContext", { value: "chrome" });
    await client.request("WebDriver:CloseWindow");
    await client.request("WebDriver:SwitchToWindow", {
      handle: originalHandle,
    });
    await client.request("Marionette:SetContext", { value: "chrome" });
    await waitForState(
      client,
      (state) => state?.managedWindowCount === 1,
      "FENNEVIA_FIREFOX_TEST_SECOND_WINDOW_CLOSE_TIMEOUT",
    );
    evidence = await collectEvidence(client);
    assert.equal(countEvent(evidence, "window.disposed", "normal"), 1);
    assert.equal(countEvent(evidence, "shell.hosts-disposed", "normal"), 1);
    assert.equal(countEvent(evidence, "bridge.boundary-disposed", "normal"), 1);

    const cssFailureWindowResult = await client.request("WebDriver:NewWindow", {
      focus: true,
      private: false,
      type: "window",
    });
    const cssFailureWindow =
      cssFailureWindowResult.value ?? cssFailureWindowResult;
    assert.equal(cssFailureWindow.type, "window");
    await waitForState(
      client,
      (state) => state?.managedWindowCount === 2,
      "FENNEVIA_FIREFOX_TEST_NATIVE_UI_CSS_WINDOW_TIMEOUT",
    );
    await client.request("WebDriver:SwitchToWindow", {
      handle: cssFailureWindow.handle,
    });
    await client.request("Marionette:SetContext", { value: "chrome" });
    assertShellHostState(await collectShellHostState(client), "normal");
    assert.deepEqual(await exercisePartialNativeUiCssFailOpen(client), {
      activeCleared: true,
      hostRemoved: true,
      nativeNavigationVisible: true,
      nativeTabsVisible: true,
      nativeWindowControlVisible: true,
      styleRemoved: true,
    });
    await assertNoShellHosts(client);
    evidence = await collectEvidence(client);
    const cssFailures = evidence.records.filter(
      (record) =>
        record.event === "shell.lifecycle-failed" &&
        record.code === "FENNEVIA_NATIVE_UI_STYLE_PARTIAL",
    );
    assert.equal(cssFailures.length, 1);
    assert.equal(cssFailures[0].phase, "native-ui-style-validate");
    assert.equal(cssFailures[0].windowKind, "normal");
    await client.request("WebDriver:SwitchToWindow", {
      handle: originalHandle,
    });
    await client.request("Marionette:SetContext", { value: "chrome" });
    assertShellHostState(await collectShellHostState(client), "normal");
    await client.request("WebDriver:SwitchToWindow", {
      handle: cssFailureWindow.handle,
    });
    await client.request("Marionette:SetContext", { value: "chrome" });
    await client.request("WebDriver:CloseWindow");
    await client.request("WebDriver:SwitchToWindow", {
      handle: originalHandle,
    });
    await client.request("Marionette:SetContext", { value: "chrome" });
    await waitForState(
      client,
      (state) => state?.managedWindowCount === 1,
      "FENNEVIA_FIREFOX_TEST_NATIVE_UI_CSS_WINDOW_CLOSE_TIMEOUT",
    );
    evidence = await collectEvidence(client);
    assert.equal(countEvent(evidence, "window.disposed", "normal"), 2);
    assert.equal(countEvent(evidence, "shell.hosts-disposed", "normal"), 2);
    assert.equal(countEvent(evidence, "bridge.boundary-disposed", "normal"), 2);

    const privateWindowResult = await client.request("WebDriver:NewWindow", {
      focus: true,
      private: true,
      type: "window",
    });
    const privateWindow = privateWindowResult.value ?? privateWindowResult;
    assert.equal(privateWindow.type, "window");
    await waitForState(
      client,
      (state) => state?.managedWindowCount === 2,
      "FENNEVIA_FIREFOX_TEST_PRIVATE_WINDOW_TIMEOUT",
    );
    evidence = await collectEvidence(client);
    assert.equal(countEvent(evidence, "window.initialized", "private"), 1);
    assert.equal(countEvent(evidence, "shell.hosts-ready", "private"), 1);
    assert.equal(countEvent(evidence, "bridge.boundary-created", "private"), 1);
    assert.equal(countEvent(evidence, "bridge.boundary-ready", "private"), 1);

    await client.request("WebDriver:SwitchToWindow", {
      handle: privateWindow.handle,
    });
    await client.request("Marionette:SetContext", { value: "chrome" });
    assertShellHostState(await collectShellHostState(client), "private");
    assertFrontendState(await collectFrontendState(client), "private");
    assertEdgeShellInteraction(await exerciseEdgeShell(client));
    assertDownloadsMvp(await exerciseDownloadsMvp(client), "private");
    assertFrontendState(await collectFrontendState(client), "private");
    await client.execute(`
      gBrowser.addTrustedTab(BROWSER_NEW_TAB_URL, { inBackground: true });
    `);
    await waitForFrontendTabCount(client, 2);
    await client.execute(`
      gBrowser.removeTab(gBrowser.openTabs.at(-1), {
        animate: false,
        isUserTriggered: true,
      });
    `);
    await waitForFrontendTabCount(client, 1);
    await client.request("WebDriver:CloseWindow");
    await client.request("WebDriver:SwitchToWindow", {
      handle: originalHandle,
    });
    await client.request("Marionette:SetContext", { value: "chrome" });
    await waitForState(
      client,
      (state) => state?.managedWindowCount === 1,
      "FENNEVIA_FIREFOX_TEST_PRIVATE_WINDOW_CLOSE_TIMEOUT",
    );
    evidence = await collectEvidence(client);
    assert.equal(countEvent(evidence, "window.disposed", "private"), 1);
    assert.equal(countEvent(evidence, "shell.hosts-disposed", "private"), 1);
    assert.equal(
      countEvent(evidence, "bridge.boundary-disposed", "private"),
      1,
    );
    assertFrontendState(await collectFrontendState(client), "normal");

    const firstStop = await client.execute(`
      const { startProcessRuntime } = ChromeUtils.importESModule(
        "chrome://fennevia/content/runtime/Runtime.sys.mjs"
      );
      return startProcessRuntime({ createWindowManager() {} }).runtime.stop();
    `);
    const secondStop = await client.execute(`
      const { startProcessRuntime } = ChromeUtils.importESModule(
        "chrome://fennevia/content/runtime/Runtime.sys.mjs"
      );
      return startProcessRuntime({ createWindowManager() {} }).runtime.stop();
    `);
    assert.equal(firstStop.state, "stopped");
    assert.equal(firstStop.managedWindowCount, 0);
    assert.deepEqual(secondStop, firstStop);
    await assertNoShellHosts(client);

    assert.deepEqual(await exerciseMissingInsertionPointFailOpen(client), {
      browserVisible: true,
      code: "FENNEVIA_SHELL_TABBOX_INVALID",
      domPath: "html#main-window>body>#browser>#tabbrowser-tabbox",
      hostCount: 0,
      nativeTabboxRestored: true,
      nativeToolboxPresent: true,
    });
    await assertNoShellHosts(client);

    const postStopWindow = await client.request("WebDriver:NewWindow", {
      focus: true,
      private: false,
      type: "window",
    });
    const postStopBrowserWindow = postStopWindow.value ?? postStopWindow;
    await new Promise((resolve) => setTimeout(resolve, 500));
    assert.equal(
      (
        await client.execute(`
          const { startProcessRuntime } = ChromeUtils.importESModule(
            "chrome://fennevia/content/runtime/Runtime.sys.mjs"
          );
          return startProcessRuntime({ createWindowManager() {} }).runtime.snapshot();
        `)
      ).managedWindowCount,
      0,
    );
    await client.request("WebDriver:SwitchToWindow", {
      handle: postStopBrowserWindow.handle,
    });
    await client.request("Marionette:SetContext", { value: "chrome" });
    await assertNoShellHosts(client);
    await client.request("WebDriver:CloseWindow");
    await client.request("WebDriver:SwitchToWindow", {
      handle: originalHandle,
    });
    await client.request("Marionette:SetContext", { value: "chrome" });

    evidence = await collectEvidence(client);
    assert.equal(countEvent(evidence, "runtime.stopped"), 1);
    assert.equal(countEvent(evidence, "shell.hosts-disposed", "normal"), 3);
    assert.equal(countEvent(evidence, "shell.hosts-disposed", "private"), 1);
    assert.equal(countEvent(evidence, "bridge.boundary-disposed", "normal"), 3);
    assert.equal(
      countEvent(evidence, "bridge.boundary-disposed", "private"),
      1,
    );
    const expectedShellFailures = evidence.records.filter(
      (record) => record.event === "shell.hosts-failed",
    );
    assert.equal(expectedShellFailures.length, 1);
    assert.equal(
      expectedShellFailures[0].code,
      "FENNEVIA_SHELL_TABBOX_INVALID",
    );
    assert.equal(
      expectedShellFailures[0].domPath,
      "html#main-window>body>#browser>#tabbrowser-tabbox",
    );
    assert.equal(expectedShellFailures[0].firefoxVersion, "153.0.4");
    assert.equal(expectedShellFailures[0].buildId, "20260810162159");
    assert.ok(Array.isArray(expectedShellFailures[0].stack));
    assert.ok(expectedShellFailures[0].stack.length > 0);
    assert.equal(countEvent(evidence, "window.disposed", "normal"), 3);
    assert.equal(countEvent(evidence, "window.disposed", "private"), 1);
    const expectedLifecycleFailures = evidence.records.filter(
      (record) => record.event === "shell.lifecycle-failed",
    );
    if (expectedLifecycleFailures.length !== 2) {
      console.error(
        `lifecycleFailureDiagnostics=${JSON.stringify(
          expectedLifecycleFailures.map((record) => ({
            code: record.code,
            domPath: record.domPath,
            nearby: (() => {
              const index = evidence.records.indexOf(record);
              return evidence.records
                .slice(Math.max(0, index - 3), index + 4)
                .map((candidate) => ({
                  code: candidate.code,
                  event: candidate.event,
                  windowKind: candidate.windowKind,
                }));
            })(),
            phase: record.phase,
            windowKind: record.windowKind,
          })),
        )}`,
      );
    }
    assert.equal(expectedLifecycleFailures.length, 2);
    assert.equal(
      expectedLifecycleFailures[0].code,
      "FENNEVIA_EMERGENCY_FALLBACK_INVOKED",
    );
    assert.equal(
      expectedLifecycleFailures[0].phase,
      "shell-emergency-fallback",
    );
    assert.equal(expectedLifecycleFailures[0].firefoxVersion, "153.0.4");
    assert.equal(expectedLifecycleFailures[0].buildId, "20260810162159");
    assert.ok(Array.isArray(expectedLifecycleFailures[0].stack));
    assert.ok(
      expectedLifecycleFailures[0].stack.some((line) =>
        line.includes("WindowShell.sys.mjs"),
      ),
    );
    assert.equal(
      expectedLifecycleFailures[1].code,
      "FENNEVIA_NATIVE_UI_STYLE_PARTIAL",
    );
    assert.equal(
      expectedLifecycleFailures[1].phase,
      "native-ui-style-validate",
    );
    assert.equal(expectedLifecycleFailures[1].firefoxVersion, "153.0.4");
    assert.equal(expectedLifecycleFailures[1].buildId, "20260810162159");
    assert.ok(Array.isArray(expectedLifecycleFailures[1].stack));
    assert.ok(
      expectedLifecycleFailures[1].stack.some((line) =>
        line.includes("NativeUi.sys.mjs"),
      ),
    );
    const unexpectedErrorRecords = evidence.records.filter(
      (record) =>
        record.level === "error" &&
        record.event !== "shell.hosts-failed" &&
        record.event !== "shell.lifecycle-failed",
    );
    if (unexpectedErrorRecords.length !== 0) {
      console.error(
        `safeErrorRecords=${JSON.stringify(
          unexpectedErrorRecords.map((record) => ({
            code: record.code,
            errorName: record.errorName,
            event: record.event,
            phase: record.phase,
            stack: record.stack,
            windowKind: record.windowKind,
          })),
        )}`,
      );
    }
    assert.equal(unexpectedErrorRecords.length, 0);
    assert.equal(evidence.firstPartyScriptErrorCount, 0);

    await client.request("Marionette:AcceptConnections", { value: false });
    quitRequested = true;
    try {
      await client.request("Marionette:Quit", {});
    } catch {
      // A clean application quit may close Marionette before its response arrives.
    }
    await waitForProcessExit(child, PROCESS_EXIT_TIMEOUT_MS);

    const browserToolboxEvidence = options.browserToolbox
      ? " Browser Toolbox Inspector selected the shared frame and confirmed the four edge plus address-overlay XHTML ownership boundaries;"
      : "";
    console.log(
      "PASS: Firefox lifecycle managed existing, second, and private windows;" +
        browserToolboxEvidence +
        " activated content-only UI; retained complete native reveal/fallback; " +
        "validated resize/maximize/minimize/fullscreen/customize; excluded a tab; " +
        "disposed on close/stop; and emitted no unexpected first-party script errors.",
    );
  } finally {
    if (child.exitCode === null) {
      if (!quitRequested && client) {
        try {
          await client.request("Marionette:Quit", {});
        } catch {
          // The exact spawned process is terminated below if graceful quit failed.
        }
      }
      if (child.exitCode === null) {
        try {
          await waitForProcessExit(child, 3_000);
        } catch {
          child.kill();
          try {
            await waitForProcessExit(child, 5_000);
          } catch {
            // The caller receives the original failure and can inspect only
            // the explicitly selected copied-program process locally.
          }
        }
      }
    }
    client?.close();
  }
}

try {
  await run();
} catch (error) {
  const code = /^FENNEVIA_[A-Z0-9_-]+$/u.test(String(error?.message))
    ? error.message
    : "FENNEVIA_FIREFOX_TEST_UNEXPECTED";
  const errorName = /^[A-Za-z][A-Za-z0-9_.-]{0,79}$/u.test(String(error?.name))
    ? error.name
    : "UnsafeErrorName";
  const ownFrame = String(error?.stack).match(
    /firefox-window-lifecycle\.mjs:(\d+):(\d+)/u,
  );
  const sourceLocation = ownFrame
    ? `firefox-window-lifecycle.mjs:${ownFrame[1]}:${ownFrame[2]}`
    : "<NO_PROJECT_FRAME>";
  console.error(`FAIL [${code}] pathDisclosure=redacted`);
  console.error(`diagnostic=${errorName} source=${sourceLocation}`);
  process.exitCode = 1;
}
