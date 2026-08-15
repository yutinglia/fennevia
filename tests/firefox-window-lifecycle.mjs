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
const BROWSER_TOOLBOX_TIMEOUT_MS = 45_000;

function parseArguments(argv) {
  const result = {
    expectFailOpen: false,
    expectStock: false,
    inspectDom: false,
    browserToolbox: false,
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
    if (argument === "--expect-stock") {
      result.expectStock = true;
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
    throw new Error("FENNEVIA_FIREFOX_TEST_ARGUMENT_UNKNOWN");
  }

  if (!result.firefox || !result.profile) {
    throw new Error("FENNEVIA_FIREFOX_TEST_ARGUMENT_REQUIRED");
  }
  if (
    [result.expectFailOpen, result.expectStock, result.inspectDom].filter(
      Boolean
    ).length > 1
  ) {
    throw new Error("FENNEVIA_FIREFOX_TEST_MODE_CONFLICT");
  }
  if (
    result.browserToolbox &&
    (result.expectFailOpen || result.expectStock || result.inspectDom)
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
    "chrome/fennevia/content/runtime/WindowShell.sys.mjs",
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
          if (/^FENNEVIA_[A-Z0-9_]{1,120}$/u.test(remoteMessage)) {
            throw new Error(remoteMessage);
          }
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

  execute(script, timeoutMs = STATE_TIMEOUT_MS) {
    return this.request("WebDriver:ExecuteScript", {
      args: [],
      filename: "fennevia-window-lifecycle.mjs",
      line: 1,
      newSandbox: true,
      sandbox: "system",
      script: script.trim(),
    }, timeoutMs).then(result => result?.value);
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
    const hostIds = [
      "fennevia-shell-primary-host",
      "fennevia-shell-sidebar-host",
      "fennevia-shell-overlay-host",
    ];
    const [primary, sidebar, overlay] = hostIds.map(id =>
      document.getElementById(id)
    );
    const toolbox = document.getElementById("navigator-toolbox");
    const browser = document.getElementById("browser");
    const tabbox = document.getElementById("tabbrowser-tabbox");
    const announcement = document.getElementById("a11y-announcement");
    const modalDialog = document.getElementById("window-modal-dialog");
    const primaryRect = primary?.getBoundingClientRect();
    const toolboxRect = toolbox?.getBoundingClientRect();
    const browserRect = browser?.getBoundingClientRect();
    const bodyChildren = Array.from(document.body.children);
    const browserChildren = Array.from(browser?.children ?? []);
    const allProjectElements = hostIds.flatMap(id => {
      const host = document.getElementById(id);
      return host ? [host, ...host.querySelectorAll("*")] : [];
    });
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
      diagnosticText:
        primary
          ?.querySelector(".fennevia-shell-diagnostic")
          ?.textContent?.replace(/\\s+/gu, " ")
          .trim() ?? "",
      hostCount: hostIds.filter(id => document.getElementById(id)).length,
      hostIdCount: document.querySelectorAll('[id^="fennevia-shell-"]').length,
      nativeModalAvailable: Boolean(
        modalDialog && typeof modalDialog.showModal === "function"
      ),
      nativeTabboxStillPresent: Boolean(tabbox),
      nativeWindowControlsPresent: Boolean(
        toolbox?.querySelector(
          '.titlebar-buttonbox-container .titlebar-close[command="cmd_closeWindow"]'
        )
      ),
      namespaceComplete: allProjectElements.every(
        element => element.namespaceURI === XHTML_NS
      ),
      overlay: {
        hidden: Boolean(overlay?.hidden),
        inert: Boolean(overlay?.hasAttribute("inert")),
        parentIsBody: overlay?.parentElement === document.body,
        pointerEvents: overlay ? getComputedStyle(overlay).pointerEvents : null,
      },
      ownershipComplete: allProjectElements.every(element => {
        const host = element.closest?.('[id^="fennevia-shell-"]');
        return host && hostIds.includes(host.id);
      }),
      placement: {
        overlayBeforeAnnouncement:
          bodyChildren.indexOf(overlay) + 1 ===
          bodyChildren.indexOf(announcement),
        primaryBeforeBrowser:
          bodyChildren.indexOf(primary) + 1 === bodyChildren.indexOf(browser),
        sidebarBeforeTabbox:
          browserChildren.indexOf(sidebar) + 1 ===
          browserChildren.indexOf(tabbox),
      },
      primary: {
        browserStartsAfterHost:
          Math.round(primaryRect?.bottom ?? -1) ===
          Math.round(browserRect?.top ?? -2),
        height: Math.round(primaryRect?.height ?? 0),
        parentIsBody: primary?.parentElement === document.body,
        toolboxEndsBeforeHost:
          Math.round(toolboxRect?.bottom ?? -1) ===
          Math.round(primaryRect?.top ?? -2),
        visible: primary ? getComputedStyle(primary).display !== "none" : false,
      },
      sidebar: {
        hidden: Boolean(sidebar?.hidden),
        parentIsBrowser: sidebar?.parentElement === browser,
      },
    };
  `);
}

function assertShellHostState(state, windowKind) {
  assert.equal(state.active, false);
  assert.equal(state.browserStillPresent, true);
  assert.equal(state.nativeTabboxStillPresent, true);
  assert.equal(state.nativeModalAvailable, true);
  assert.equal(state.nativeWindowControlsPresent, true);
  assert.equal(state.completeSet, true);
  assert.equal(state.hostCount, 3);
  assert.equal(state.hostIdCount, 3);
  assert.equal(state.namespaceComplete, true);
  assert.equal(state.ownershipComplete, true);
  assert.equal(state.primary.parentIsBody, true);
  assert.equal(state.primary.visible, true);
  assert.ok(state.primary.height >= 30);
  assert.equal(state.primary.toolboxEndsBeforeHost, true);
  assert.equal(state.primary.browserStartsAfterHost, true);
  assert.equal(state.sidebar.parentIsBrowser, true);
  assert.equal(state.sidebar.hidden, true);
  assert.equal(state.overlay.parentIsBody, true);
  assert.equal(state.overlay.hidden, true);
  assert.equal(state.overlay.inert, true);
  assert.equal(state.overlay.pointerEvents, "none");
  assert.equal(state.placement.primaryBeforeBrowser, true);
  assert.equal(state.placement.sidebarBeforeTabbox, true);
  assert.equal(state.placement.overlayBeforeAnnouncement, true);
  assert.equal(state.contentHitInsideProjectHost, false);
  assert.match(state.diagnosticText, /Fennevia host layer ready/u);
  assert.match(
    state.diagnosticText,
    windowKind === "private" ? /Private window/u : /Normal window/u
  );
  assert.match(state.diagnosticText, /Native UI retained/u);
  assert.doesNotMatch(
    state.diagnosticText,
    /(?:https?:|file:|about:|chrome:|resource:|[A-Za-z]:[\\/]|\\\\)/iu
  );
}

async function assertNoShellHosts(client) {
  const state = await collectShellHostState(client);
  assert.equal(state.active, false);
  assert.equal(state.browserStillPresent, true);
  assert.equal(state.nativeTabboxStillPresent, true);
  assert.equal(state.nativeWindowControlsPresent, true);
  assert.equal(state.hostCount, 0);
  assert.equal(state.hostIdCount, 0);
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

async function exerciseMissingInsertionPointFailOpen(client) {
  return client.execute(`
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
      initializeWindowShell({
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
  `);
}

async function acceptBrowserToolboxConnectionPrompt(client) {
  const deadline = Date.now() + BROWSER_TOOLBOX_TIMEOUT_MS;
  while (Date.now() < deadline) {
    try {
      const alertResult = await client.request(
        "WebDriver:GetAlertText",
        {},
        5_000
      );
      const alertText = alertResult?.value ?? alertResult;
      if (typeof alertText === "string") {
        await client.request("WebDriver:AcceptAlert", {}, 5_000);
        return true;
      }
    } catch {
      // The prompt is created asynchronously after the toolbox process starts.
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error("FENNEVIA_FIREFOX_TEST_BROWSER_TOOLBOX_PROMPT_TIMEOUT");
}

async function cleanupBrowserToolboxProbe(client) {
  return client.execute(`
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
  `, BROWSER_TOOLBOX_TIMEOUT_MS);
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
    const launchState = await client.execute(`
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
    `, BROWSER_TOOLBOX_TIMEOUT_MS);
    assert.deepEqual(launchState, {
      promptConnectionEnabled: true,
      sessionActive: true,
    });
    assert.equal(await acceptBrowserToolboxConnectionPrompt(client), true);

    const inspectorExpression = `(async () => {
      const XHTML_NS = "http://www.w3.org/1999/xhtml";
      const inspector = await gToolbox.selectTool("inspector");
      const walker = inspector.walker;
      const rootNode = await walker.getRootNode();
      const query = selector => walker.querySelector(rootNode, selector);
      const [body, browser, toolbox, tabbox, primary, sidebar, overlay] =
        await Promise.all([
          query("body"),
          query("#browser"),
          query("#navigator-toolbox"),
          query("#tabbrowser-tabbox"),
          query("#fennevia-shell-primary-host"),
          query("#fennevia-shell-sidebar-host"),
          query("#fennevia-shell-overlay-host"),
        ]);
      const hosts = [primary, sidebar, overlay];
      const nativeNodes = [browser, toolbox, tabbox];
      if ([body, ...hosts, ...nativeNodes].some(node => !node)) {
        return JSON.stringify({ error: "FENNEVIA_HOST_OR_NATIVE_NODE_MISSING" });
      }

      const projectElements = [];
      for (const host of hosts) {
        const pending = [host];
        while (pending.length > 0) {
          const node = pending.shift();
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

      inspector.selection.setNodeFront(primary, {
        reason: "fennevia-ownership-probe",
      });

      return JSON.stringify({
        hostCount: hosts.length,
        namespaceComplete: projectElements.every(
          node => node.namespaceURI === XHTML_NS
        ),
        nativeOutsideHosts,
        overlayParentIsBody: overlay.parentNode() === body,
        primaryParentIsBody: primary.parentNode() === body,
        projectElementCount: projectElements.length,
        selectedHostId: inspector.selection.nodeFront.id,
        sidebarParentIsBrowser: sidebar.parentNode() === browser,
        toolId: gToolbox.currentToolId,
      });
    })()`;

    const inspectorResult = await client.execute(`
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
    `, BROWSER_TOOLBOX_TIMEOUT_MS);

    assert.equal(inspectorResult.error, undefined);
    assert.equal(inspectorResult.hostCount, 3);
    assert.equal(inspectorResult.namespaceComplete, true);
    assert.equal(inspectorResult.nativeOutsideHosts, true);
    assert.equal(inspectorResult.overlayParentIsBody, true);
    assert.equal(inspectorResult.primaryParentIsBody, true);
    assert.ok(inspectorResult.projectElementCount >= 10);
    assert.equal(
      inspectorResult.selectedHostId,
      "fennevia-shell-primary-host"
    );
    assert.equal(inspectorResult.sidebarParentIsBrowser, true);
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
    options.expectStock || options.inspectDom
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
    if (options.browserToolbox) {
      await client.request("WebDriver:SetTimeouts", {
        script: BROWSER_TOOLBOX_TIMEOUT_MS,
      });
    }
    await client.request("Marionette:SetContext", { value: "chrome" });

    const originalHandle = (
      await client.request("WebDriver:GetWindowHandle")
    ).value;
    assert.equal(typeof originalHandle, "string");

    if (options.inspectDom) {
      await new Promise(resolve => setTimeout(resolve, 750));
      const snapshot = await collectBrowserDomSnapshot(client);
      assert.equal(
        snapshot.documentUri,
        "chrome://browser/content/browser.xhtml"
      );
      assert.equal(snapshot.root.localName, "html");
      assert.equal(snapshot.root.id, "main-window");
      assert.equal(snapshot.root.namespaceURI, snapshot.xhtmlNamespace);
      assert.equal(snapshot.body.localName, "body");
      assert.equal(snapshot.body.namespaceURI, snapshot.xhtmlNamespace);

      const bySelector = Object.fromEntries(
        snapshot.elements.map(element => [element.selector, element])
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
        snapshot.bodyOrder.navigatorToolbox < snapshot.bodyOrder.browser
      );
      assert.ok(snapshot.bodyOrder.browser < snapshot.bodyOrder.fullscreenToggler);
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
        `PASS: stock browser DOM snapshot ${JSON.stringify(snapshot)}`
      );
      return;
    }

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
    assertShellHostState(await collectShellHostState(client), "normal");
    await assertNativeModalUnobstructed(client);
    if (options.browserToolbox) {
      await runBrowserToolboxOwnershipProbe(client);
      assertShellHostState(await collectShellHostState(client), "normal");
    }

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
    await client.request("Marionette:SetContext", { value: "chrome" });
    assertShellHostState(await collectShellHostState(client), "normal");
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
    await client.request("Marionette:SetContext", { value: "chrome" });
    assertShellHostState(await collectShellHostState(client), "private");
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
    await client.request("Marionette:SetContext", { value: "chrome" });
    await assertNoShellHosts(client);
    await client.request("WebDriver:CloseWindow");
    await client.request("WebDriver:SwitchToWindow", { handle: originalHandle });
    await client.request("Marionette:SetContext", { value: "chrome" });

    evidence = await collectEvidence(client);
    assert.equal(countEvent(evidence, "bootstrap.success"), 1);
    assert.equal(countEvent(evidence, "runtime.started"), 1);
    assert.equal(countEvent(evidence, "runtime.stopped"), 1);
    assert.equal(countEvent(evidence, "window.initialized", "normal"), 2);
    assert.equal(countEvent(evidence, "window.initialized", "private"), 1);
    assert.equal(countEvent(evidence, "shell.hosts-ready", "normal"), 2);
    assert.equal(countEvent(evidence, "shell.hosts-ready", "private"), 1);
    assert.equal(countEvent(evidence, "shell.hosts-disposed", "normal"), 2);
    assert.equal(countEvent(evidence, "shell.hosts-disposed", "private"), 1);
    const expectedShellFailures = evidence.records.filter(
      record => record.event === "shell.hosts-failed"
    );
    assert.equal(expectedShellFailures.length, 1);
    assert.equal(
      expectedShellFailures[0].code,
      "FENNEVIA_SHELL_TABBOX_INVALID"
    );
    assert.equal(
      expectedShellFailures[0].domPath,
      "html#main-window>body>#browser>#tabbrowser-tabbox"
    );
    assert.equal(expectedShellFailures[0].firefoxVersion, "153.0.4");
    assert.equal(expectedShellFailures[0].buildId, "20260810162159");
    assert.equal(countEvent(evidence, "window.disposed", "normal"), 2);
    assert.equal(countEvent(evidence, "window.disposed", "private"), 1);
    assert.equal(
      evidence.records.filter(
        record =>
          record.level === "error" && record.event !== "shell.hosts-failed"
      ).length,
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

    const browserToolboxEvidence = options.browserToolbox
      ? " Browser Toolbox Inspector selected the primary host and confirmed the XHTML ownership boundary;"
      : "";
    console.log(
      "PASS: Firefox lifecycle managed existing, second, and private windows;" +
        browserToolboxEvidence +
        " excluded a tab; disposed on close/stop; retained native UI; and emitted " +
        "no unexpected first-party script errors."
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
