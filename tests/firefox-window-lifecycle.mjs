import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { access, readFile } from "node:fs/promises";
import net from "node:net";
import path from "node:path";
import process from "node:process";

const DEFAULT_PORT = 2828;
const CONNECT_TIMEOUT_MS = 30_000;
const STATE_TIMEOUT_MS = 20_000;
const PROCESS_EXIT_TIMEOUT_MS = 20_000;

function parseArguments(argv) {
  const result = { expectFailOpen: false, expectStock: false };
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
    if (argument === "--expect-stock") {
      result.expectStock = true;
      continue;
    }
    throw new Error("FENNEVIA_FIREFOX_TEST_ARGUMENT_UNKNOWN");
  }

  if (!result.firefox || !result.profile) {
    throw new Error("FENNEVIA_FIREFOX_TEST_ARGUMENT_REQUIRED");
  }
  if (result.expectFailOpen && result.expectStock) {
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

async function validateTarget(
  firefoxPath,
  profilePath,
  expectFailOpen,
  expectStock
) {
  if (!path.isAbsolute(firefoxPath) || !path.isAbsolute(profilePath)) {
    throw new Error("FENNEVIA_FIREFOX_TEST_TARGET_NOT_ABSOLUTE");
  }
  if (path.basename(firefoxPath).toLowerCase() !== "firefox.exe") {
    throw new Error("FENNEVIA_FIREFOX_TEST_EXECUTABLE_INVALID");
  }

  await access(firefoxPath);
  const applicationPath = path.join(path.dirname(firefoxPath), "application.ini");
  const applicationIni = await readFile(applicationPath, "utf8");
  if (!/^Name=Firefox$/mu.test(applicationIni)) {
    throw new Error("FENNEVIA_FIREFOX_TEST_APPLICATION_INVALID");
  }

  const programMarkerPath = path.join(
    path.dirname(firefoxPath),
    ".fennevia-program-spike.json"
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
    "chrome/fennevia/content/runtime/Logger.sys.mjs",
    "chrome/fennevia/content/runtime/Runtime.sys.mjs",
  ];
  if (!expectFailOpen && !expectStock) {
    requiredArtifacts.push(
      "chrome/fennevia/content/runtime/WindowManager.sys.mjs"
    );
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
}

async function assertPortAvailable(port) {
  const server = net.createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", resolve);
  });
  await new Promise((resolve, reject) => {
    server.close(error => (error ? reject(error) : resolve()));
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

    socket.on("data", chunk => this.onData(chunk));
    socket.on("close", () => this.onClose());
    socket.on("error", error => this.onClose(error));
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
          new Error("FENNEVIA_FIREFOX_TEST_MARIONETTE_FRAME_INVALID")
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
          new Error("FENNEVIA_FIREFOX_TEST_MARIONETTE_JSON_INVALID")
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
        new Error("FENNEVIA_FIREFOX_TEST_MARIONETTE_CLOSED")
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

  async request(name, parameters = {}) {
    this.nextCommandId += 1;
    const commandId = this.nextCommandId;
    this.send([0, commandId, name, parameters]);

    while (true) {
      const response = await this.nextFrame(STATE_TIMEOUT_MS);
      if (
        Array.isArray(response) &&
        response[0] === 1 &&
        response[1] === commandId
      ) {
        if (response[2]) {
          const remoteCode = String(response[2].error ?? "unknown error")
            .replace(/[^A-Za-z0-9_-]/gu, "_")
            .toUpperCase()
            .slice(0, 80);
          const commandCode = name
            .replace(/[^A-Za-z0-9]/gu, "_")
            .toUpperCase();
          throw new Error(
            `FENNEVIA_FIREFOX_TEST_REMOTE_${remoteCode}_${commandCode}`
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

  execute(script) {
    return this.request("WebDriver:ExecuteScript", {
      args: [],
      filename: "fennevia-window-lifecycle.mjs",
      line: 1,
      newSandbox: true,
      sandbox: "system",
      script: script.trim(),
    }).then(result => result?.value);
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
      await new Promise(resolve => setTimeout(resolve, 250));
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
    await new Promise(resolve => setTimeout(resolve, 100));
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

const EXPECTED_NATIVE_STATE = Object.freeze({
  active: false,
  documentUri: "chrome://browser/content/browser.xhtml",
  mainWindowId: "main-window",
  nativeToolboxPresent: true,
  windowType: "navigator:browser",
});

function countEvent(evidence, event, windowKind) {
  return evidence.records.filter(
    record =>
      record.event === event &&
      (windowKind === undefined || record.windowKind === windowKind)
  ).length;
}

async function waitForProcessExit(child, timeoutMs) {
  if (child.exitCode !== null) {
    return child.exitCode;
  }
  return Promise.race([
    new Promise(resolve => child.once("exit", resolve)),
    new Promise((resolve, reject) =>
      setTimeout(
        () => reject(new Error("FENNEVIA_FIREFOX_TEST_PROCESS_EXIT_TIMEOUT")),
        timeoutMs
      )
    ),
  ]);
}

async function run() {
  const options = parseArguments(process.argv.slice(2));
  await validateTarget(
    options.firefox,
    options.profile,
    options.expectFailOpen,
    options.expectStock
  );
  await assertPortAvailable(DEFAULT_PORT);

  const child = spawn(
    options.firefox,
    [
      "--marionette",
      "--remote-allow-system-access",
      "--no-remote",
      "--new-instance",
      "--profile",
      options.profile,
      "--new-window",
      "about:blank",
    ],
    {
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: false,
    }
  );
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
    await client.request("Marionette:SetContext", { value: "chrome" });

    const originalHandle = (
      await client.request("WebDriver:GetWindowHandle")
    ).value;
    assert.equal(typeof originalHandle, "string");

    if (options.expectStock) {
      await new Promise(resolve => setTimeout(resolve, 750));
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
          "Fennevia records or owned-file residue."
      );
      return;
    }

    if (options.expectFailOpen) {
      await new Promise(resolve => setTimeout(resolve, 750));
      assert.deepEqual(await collectNativeState(client), EXPECTED_NATIVE_STATE);
      const evidence = await collectEvidence(client);
      const fatalRecords = evidence.records.filter(
        record => record.event === "bootstrap.fatal"
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
        "PASS: missing lifecycle module failed open with one caught bootstrap " +
          "fatal record while native browser UI remained available."
      );
      return;
    }

    const initialState = await waitForState(
      client,
      state =>
        state?.state === "started" &&
        state.initializationCount === 1 &&
        state.managedWindowCount === 1,
      "FENNEVIA_FIREFOX_TEST_INITIAL_STATE_TIMEOUT"
    );
    assert.equal(initialState.initializingWindowCount, 0);

    assert.deepEqual(await collectNativeState(client), EXPECTED_NATIVE_STATE);

    const tabResult = await client.request("WebDriver:NewWindow", {
      focus: false,
      type: "tab",
    });
    const tabWindow = tabResult.value ?? tabResult;
    assert.equal(tabWindow.type, "tab");
    await new Promise(resolve => setTimeout(resolve, 250));
    assert.equal(
      (await waitForState(
        client,
        state => state?.managedWindowCount === 1,
        "FENNEVIA_FIREFOX_TEST_TAB_EXCLUSION_TIMEOUT"
      )).managedWindowCount,
      1
    );
    await client.request("WebDriver:SwitchToWindow", {
      handle: tabWindow.handle,
    });
    await client.request("WebDriver:CloseWindow");
    await client.request("WebDriver:SwitchToWindow", { handle: originalHandle });
    await client.request("Marionette:SetContext", { value: "chrome" });

    const secondWindowResult = await client.request("WebDriver:NewWindow", {
      focus: true,
      private: false,
      type: "window",
    });
    const secondWindow = secondWindowResult.value ?? secondWindowResult;
    assert.equal(secondWindow.type, "window");
    await waitForState(
      client,
      state => state?.managedWindowCount === 2,
      "FENNEVIA_FIREFOX_TEST_SECOND_WINDOW_TIMEOUT"
    );
    let evidence = await collectEvidence(client);
    assert.equal(countEvent(evidence, "runtime.started"), 1);
    assert.equal(countEvent(evidence, "window.initialized", "normal"), 2);

    await client.request("WebDriver:SwitchToWindow", {
      handle: secondWindow.handle,
    });
    await client.request("WebDriver:CloseWindow");
    await client.request("WebDriver:SwitchToWindow", { handle: originalHandle });
    await client.request("Marionette:SetContext", { value: "chrome" });
    await waitForState(
      client,
      state => state?.managedWindowCount === 1,
      "FENNEVIA_FIREFOX_TEST_SECOND_WINDOW_CLOSE_TIMEOUT"
    );

    const privateWindowResult = await client.request("WebDriver:NewWindow", {
      focus: true,
      private: true,
      type: "window",
    });
    const privateWindow = privateWindowResult.value ?? privateWindowResult;
    assert.equal(privateWindow.type, "window");
    await waitForState(
      client,
      state => state?.managedWindowCount === 2,
      "FENNEVIA_FIREFOX_TEST_PRIVATE_WINDOW_TIMEOUT"
    );
    evidence = await collectEvidence(client);
    assert.equal(countEvent(evidence, "window.initialized", "private"), 1);

    await client.request("WebDriver:SwitchToWindow", {
      handle: privateWindow.handle,
    });
    await client.request("WebDriver:CloseWindow");
    await client.request("WebDriver:SwitchToWindow", { handle: originalHandle });
    await client.request("Marionette:SetContext", { value: "chrome" });
    await waitForState(
      client,
      state => state?.managedWindowCount === 1,
      "FENNEVIA_FIREFOX_TEST_PRIVATE_WINDOW_CLOSE_TIMEOUT"
    );

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

    const postStopWindow = await client.request("WebDriver:NewWindow", {
      focus: true,
      private: false,
      type: "window",
    });
    const postStopBrowserWindow = postStopWindow.value ?? postStopWindow;
    await new Promise(resolve => setTimeout(resolve, 500));
    assert.equal(
      (
        await client.execute(`
          const { startProcessRuntime } = ChromeUtils.importESModule(
            "chrome://fennevia/content/runtime/Runtime.sys.mjs"
          );
          return startProcessRuntime({ createWindowManager() {} }).runtime.snapshot();
        `)
      ).managedWindowCount,
      0
    );
    await client.request("WebDriver:SwitchToWindow", {
      handle: postStopBrowserWindow.handle,
    });
    await client.request("WebDriver:CloseWindow");
    await client.request("WebDriver:SwitchToWindow", { handle: originalHandle });
    await client.request("Marionette:SetContext", { value: "chrome" });

    evidence = await collectEvidence(client);
    assert.equal(countEvent(evidence, "bootstrap.success"), 1);
    assert.equal(countEvent(evidence, "runtime.started"), 1);
    assert.equal(countEvent(evidence, "runtime.stopped"), 1);
    assert.equal(countEvent(evidence, "window.initialized", "normal"), 2);
    assert.equal(countEvent(evidence, "window.initialized", "private"), 1);
    assert.equal(countEvent(evidence, "window.disposed", "normal"), 2);
    assert.equal(countEvent(evidence, "window.disposed", "private"), 1);
    assert.equal(
      evidence.records.filter(record => record.level === "error").length,
      0
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
      "PASS: Firefox lifecycle managed existing, second, and private windows; " +
        "excluded a tab; disposed on close/stop; retained native UI; and emitted " +
        "no first-party script errors."
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
  const errorName = /^[A-Za-z][A-Za-z0-9_.-]{0,79}$/u.test(
    String(error?.name)
  )
    ? error.name
    : "UnsafeErrorName";
  const ownFrame = String(error?.stack).match(
    /firefox-window-lifecycle\.mjs:(\d+):(\d+)/u
  );
  const sourceLocation = ownFrame
    ? `firefox-window-lifecycle.mjs:${ownFrame[1]}:${ownFrame[2]}`
    : "<NO_PROJECT_FRAME>";
  console.error(`FAIL [${code}] pathDisclosure=redacted`);
  console.error(`diagnostic=${errorName} source=${sourceLocation}`);
  process.exitCode = 1;
}
