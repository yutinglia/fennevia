// SPDX-License-Identifier: MPL-2.0
/* eslint-disable no-console -- This manual harness emits only fixture counts and closed evidence. */
// Explicit, disposable-profile feasibility test; never part of the installed package.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import {
  lstat,
  mkdir,
  readFile,
  readdir,
  realpath,
  writeFile,
} from "node:fs/promises";
import net from "node:net";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { setTimeout as delay } from "node:timers/promises";
import { MarionetteClient } from "./support/marionette-client.mjs";

const PORT = 2839;
const FIXTURE_ROOT = "fennevia-local-extension-fixtures";
const fixtureId = (version) =>
  `fennevia-local-spike-mv${version}@example.invalid`;
const background = `
let work = Promise.resolve();
function record(kind) {
  work = work.then(async () => {
    const state = await browser.storage.local.get({boots: 0, installs: 0, startups: 0});
    state[kind] += 1;
    await browser.storage.local.set(state);
    const grants = await browser.permissions.getAll();
    console.log('FENNEVIA_LOCAL_FIXTURE:' + JSON.stringify({
      mv: browser.runtime.getManifest().manifest_version,
      ...state, optional: grants.permissions.includes('bookmarks')
    }));
  });
}
browser.runtime.onInstalled.addListener(() => record('installs'));
browser.runtime.onStartup.addListener(() => record('startups'));
record('boots');
`;

async function readJSON(file) {
  return JSON.parse(await readFile(file, "utf8"));
}

async function assertPlainPath(target, root) {
  const absolute = path.resolve(target);
  const relative = path.relative(root, absolute);
  assert.ok(
    relative && !relative.startsWith("..") && !path.isAbsolute(relative),
  );
  assert.equal(
    (await realpath(absolute)).toLowerCase(),
    absolute.toLowerCase(),
  );
  let current = absolute;
  while (current !== path.dirname(current)) {
    assert.equal((await lstat(current)).isSymbolicLink(), false);
    current = path.dirname(current);
  }
}

export async function prepare(firefox, profile) {
  assert.ok(path.isAbsolute(firefox) && path.isAbsolute(profile));
  await assertPlainPath(
    profile,
    path.join(process.env.LOCALAPPDATA, "fennevia", "profiles"),
  );
  await assertPlainPath(
    firefox,
    path.join(process.env.LOCALAPPDATA, "fennevia", "program-spikes"),
  );
  const profileMarker = await readJSON(
    path.join(profile, ".fennevia-dev-profile.json"),
  );
  assert.equal(profileMarker.owner, "fennevia");
  assert.equal(profileMarker.profileName, "fennevia-dev");
  assert.equal(profileMarker.schemaVersion, 1);
  const programMarker = await readJSON(
    path.join(path.dirname(firefox), ".fennevia-program-spike.json"),
  );
  assert.equal(programMarker.owner, "fennevia");
  assert.equal(programMarker.purpose, "firefox-identity-regression");
  assert.equal(programMarker.state, "ready");
  assert.deepEqual((await readdir(profile)).sort(), [
    ".fennevia-dev-profile.json",
    "user.js",
  ]);
  const programPreferences = await readdir(
    path.join(path.dirname(firefox), "defaults", "pref"),
  );
  assert.deepEqual(programPreferences, ["channel-prefs.js"]);
  // An exclusive marker prevents accidentally rerunning against an established profile.
  await writeFile(
    path.join(profile, ".fennevia-local-extension-spike.json"),
    JSON.stringify({ owner: "fennevia", version: 1 }),
    { flag: "wx" },
  );
  const originalPreferences = await readFile(
    path.join(profile, "user.js"),
    "utf8",
  );
  await writeFile(
    path.join(profile, "user.js"),
    originalPreferences +
      `
user_pref("marionette.port", ${PORT});
user_pref("browser.shell.checkDefaultBrowser", false);
user_pref("browser.startup.page", 0);
user_pref("browser.startup.homepage_override.mstone", "ignore");
user_pref("datareporting.policy.dataSubmissionEnabled", false);
`,
  );
  for (const version of [2, 3]) {
    const directory = path.join(profile, FIXTURE_ROOT, `mv${version}`);
    await mkdir(directory, { recursive: true });
    await writeFile(
      path.join(directory, "manifest.json"),
      JSON.stringify({
        manifest_version: version,
        name: `Fennevia local feasibility MV${version}`,
        version: "1.0",
        browser_specific_settings: { gecko: { id: fixtureId(version) } },
        permissions: ["storage"],
        optional_permissions: ["bookmarks"],
        background: { scripts: ["background.js"] },
      }),
    );
    await writeFile(path.join(directory, "background.js"), background);
    await writeFile(
      path.join(directory, "probe.html"),
      '<!doctype html><meta charset="utf-8"><pre></pre><script src="probe.js"></script>',
    );
    await writeFile(
      path.join(directory, "probe.js"),
      `
      async function report() {
        const state = await browser.storage.local.get({boots:0, installs:0, startups:0});
        const grants = await browser.permissions.getAll();
        document.querySelector('pre').textContent = JSON.stringify({
          mv: browser.runtime.getManifest().manifest_version, ...state,
          optional: grants.permissions.includes('bookmarks')
        });
      }
      browser.storage.onChanged.addListener(report);
      report();
    `,
    );
  }
  for (const source of ["collision-a", "collision-b"]) {
    const directory = path.join(profile, FIXTURE_ROOT, source);
    await mkdir(directory, { recursive: true });
    await writeFile(
      path.join(directory, "manifest.json"),
      JSON.stringify({
        manifest_version: 2,
        name: "Fennevia collision feasibility",
        version: "1.0",
        browser_specific_settings: {
          gecko: { id: "fennevia-local-spike-collision@example.invalid" },
        },
      }),
    );
  }
}

const nativeHelpers = `
const { AddonManager } = ChromeUtils.importESModule('resource://gre/modules/AddonManager.sys.mjs');
const { ExtensionParent } = ChromeUtils.importESModule('resource://gre/modules/ExtensionParent.sys.mjs');
const { ExtensionPermissions } = ChromeUtils.importESModule('resource://gre/modules/ExtensionPermissions.sys.mjs');
const file = leaf => {
  const result = Services.dirsvc.get('ProfD', Ci.nsIFile);
  result.append('${FIXTURE_ROOT}'); result.append(leaf); return result;
};
`;

export async function execute(client, body) {
  return client.execute(
    `return (async () => { ${nativeHelpers}\n${body}\n})();`,
    30_000,
  );
}

export async function waitForFixture(client, version, boots) {
  const url = await execute(
    client,
    `return ExtensionParent.GlobalManager.getExtension('${fixtureId(version)}').baseURI.resolve('probe.html');`,
  );
  await client.request("Marionette:SetContext", { value: "content" });
  try {
    await client.request("WebDriver:Navigate", { url });
    for (let attempt = 0; attempt < 80; attempt++) {
      const found = await client.execute(
        `const text = document.querySelector('pre')?.textContent; return text ? JSON.parse(text) : null;`,
      );
      if (found?.boots >= boots && found?.installs >= boots) return found;
      await delay(100);
    }
    throw new Error("FENNEVIA_LOCAL_SPIKE_FIXTURE_TIMEOUT");
  } finally {
    await client.request("Marionette:SetContext", { value: "chrome" });
  }
}

export async function openSession(firefox, profile, run) {
  const server = net.createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(PORT, "127.0.0.1", resolve);
  });
  await new Promise((resolve) => server.close(resolve));
  const child = spawn(
    firefox,
    [
      "--headless",
      "--marionette",
      "--no-remote",
      "--new-instance",
      "--profile",
      profile,
      "about:blank",
    ],
    {
      windowsHide: true,
      stdio: "ignore",
      env: { ...process.env, MOZ_REMOTE_ALLOW_SYSTEM_ACCESS: "1" },
    },
  );
  const exited = once(child, "exit");
  let client;
  try {
    for (let attempt = 0; attempt < 100; attempt++) {
      if (child.exitCode !== null)
        throw new Error("FENNEVIA_LOCAL_SPIKE_EARLY_EXIT");
      try {
        client = await MarionetteClient.connect(PORT);
        break;
      } catch {
        await delay(200);
      }
    }
    if (!client) throw new Error("FENNEVIA_LOCAL_SPIKE_CONNECT_TIMEOUT");
    await client.request("WebDriver:NewSession", {});
    await client.request("WebDriver:SetTimeouts", { script: 30_000 });
    await client.request("Marionette:SetContext", { value: "chrome" });
    return await run(client);
  } finally {
    if (client) {
      try {
        await client.request("Marionette:Quit", {});
      } catch {
        /* quit can close the transport first */
      }
      client.close();
    }
    if (child.exitCode === null) {
      const abort = new AbortController();
      const clean = await Promise.race([
        exited.then(() => true),
        delay(10_000, false, { signal: abort.signal }),
      ]);
      abort.abort();
      if (!clean) {
        child.kill();
        await exited;
      }
      assert.equal(clean, true, "FENNEVIA_LOCAL_SPIKE_UNCLEAN_EXIT");
    }
  }
}

async function main() {
  const args = process.argv.slice(2);
  assert.equal(args.length, 4);
  assert.equal(args[0], "--firefox");
  assert.equal(args[2], "--profile");
  const [, firefox, , profile] = args;
  await prepare(firefox, profile);
  let previousIdentity;
  const evidence = { runs: [] };
  for (let run = 1; run <= 3; run++) {
    await openSession(firefox, profile, async (client) => {
      const identity = await execute(
        client,
        `
        await AddonManager.readyPromise;
        const evidence = {version: Services.appinfo.version, build: Services.appinfo.appBuildID, channel: Services.prefs.getCharPref('app.update.channel'), safeMode: Services.appinfo.inSafeMode};
        evidence.signaturesRequired = Services.prefs.getBoolPref('xpinstall.signatures.required', true);
        evidence.keepStorage = Services.prefs.getBoolPref('extensions.webextensions.keepStorageOnUninstall', false);
        evidence.keepUuid = Services.prefs.getBoolPref('extensions.webextensions.keepUuidOnUninstall', false);
        evidence.preexisting = [];
        const uuids = [];
        for (const version of [2,3]) {
          const id = 'fennevia-local-spike-mv' + version + '@example.invalid';
          evidence.preexisting.push(!!(await AddonManager.getAddonByID(id)));
          await AddonManager.installTemporaryAddon(file('mv' + version));
          const extension = ExtensionParent.GlobalManager.getExtension(id);
          uuids.push(extension.uuid);
        }
        return {evidence, uuids};
      `,
      );
      assert.deepEqual(identity.evidence.preexisting, [false, false]);
      assert.equal(identity.evidence.signaturesRequired, true);
      assert.equal(identity.evidence.keepStorage, false);
      assert.equal(identity.evidence.keepUuid, false);
      const fixtureStates = [];
      for (const version of [2, 3])
        fixtureStates.push(await waitForFixture(client, version, run));
      if (run === 1) {
        await execute(
          client,
          `
          for (const version of [2,3]) {
            const id = 'fennevia-local-spike-mv' + version + '@example.invalid';
            const extension = ExtensionParent.GlobalManager.getExtension(id);
            await ExtensionPermissions.add(id, {permissions:['bookmarks'], origins:[]}, extension);
          }
          return true;
        `,
        );
      }
      const uuidStable =
        !previousIdentity ||
        JSON.stringify(identity.uuids) === JSON.stringify(previousIdentity);
      previousIdentity = identity.uuids;
      evidence.runs.push({ ...identity.evidence, uuidStable, fixtureStates });
      console.log(JSON.stringify({ run, ...evidence.runs.at(-1) }));
      assert.equal(uuidStable, true);
      for (const fixture of fixtureStates) {
        assert.equal(fixture.boots, run);
        assert.equal(fixture.installs, run);
        assert.equal(fixture.startups, 0);
        assert.equal(fixture.optional, run > 1);
      }
      if (run === 3) {
        evidence.collision = await execute(
          client,
          `
          const id = 'fennevia-local-spike-collision@example.invalid';
          const precheckAbsent = !(await AddonManager.getAddonByID(id));
          const observed = [];
          const listener = {onInstalling(addon) {if(addon.id === id) observed.push('installing'); return false;},
            onInstalled(addon) {if(addon.id === id) observed.push(addon.sourceURI.equals(Services.io.newFileURI(file('collision-a'))) ? 'foreign' : 'local');}};
          AddonManager.addAddonListener(listener);
          try {
            const foreign = AddonManager.installTemporaryAddon(file('collision-a'));
            const local = AddonManager.installTemporaryAddon(file('collision-b'));
            const results = await Promise.allSettled([foreign, local]);
            const current = await AddonManager.getAddonByID(id);
            return {precheckAbsent, results:results.map(item => item.status), observed,
              finalIsLocal:current.sourceURI.equals(Services.io.newFileURI(file('collision-b'))),
              listenerVetoIgnored:!!current};
          } finally {AddonManager.removeAddonListener(listener);}
        `,
        );
        console.log(JSON.stringify({ collision: evidence.collision }));
        evidence.strictOwnershipGate = !(
          evidence.collision.precheckAbsent &&
          evidence.collision.results.every(
            (status) => status === "fulfilled",
          ) &&
          evidence.collision.observed.includes("foreign") &&
          evidence.collision.finalIsLocal
        );
      }
    });
  }
  await writeFile(
    path.join(profile, "fennevia-local-extension-evidence.json"),
    JSON.stringify(evidence, null, 2),
  );
  console.log(
    JSON.stringify({
      strictOwnershipGate: evidence.strictOwnershipGate,
      productionFeatureInstalled: false,
    }),
  );
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
)
  try {
    await main();
  } catch (error) {
    const code = /^FENNEVIA_[A-Z_]+$/.test(String(error?.message))
      ? error.message
      : "FENNEVIA_LOCAL_SPIKE_FAILED";
    const frame =
      String(error?.stack).match(
        /firefox-local-extensions-spike\.mjs:\d+:\d+/,
      )?.[0] ?? "unknown";
    console.error(JSON.stringify({ code, frame }));
    process.exitCode = 1;
  }
