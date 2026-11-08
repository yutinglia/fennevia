// SPDX-License-Identifier: MPL-2.0
/* eslint-disable no-console -- Explicit disposable-profile integration evidence, no browsing data. */
import assert from "node:assert/strict";
import {
  mkdir,
  readFile,
  rmdir,
  symlink,
  unlink,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import {
  prepare,
  openSession,
  execute,
  waitForFixture,
} from "./firefox-local-extensions-spike.mjs";

const bridgeBase = new URL(
  "../profile/chrome/fennevia/content/firefox/",
  import.meta.url,
).href;
const id = "fennevia-local-spike-mv2@example.invalid";
let phase = "prepare";
const initialize = async (client) => {
  await execute(
    client,
    `
    Services.io.getProtocolHandler("resource").QueryInterface(Ci.nsIResProtocolHandler).setSubstitution("fennevia-local-test",Services.io.newURI(${JSON.stringify(bridgeBase)}));
    const {createFirefoxLocalExtensionsRuntime}=ChromeUtils.importESModule("resource://fennevia-local-test/BridgeBoundary.sys.mjs");
    const abort=new AbortController();const errors=[];
    const runtime=createFirefoxLocalExtensionsRuntime(error=>errors.push(error?.code??'native-error'));
    const bridge=runtime.forWindow({window,isPrivate:false,signal:abort.signal});
    if(!bridge)throw new Error('FENNEVIA_LOCAL_RUNTIME_UNAVAILABLE');
    const registrar=Components.manager.QueryInterface(Ci.nsIComponentRegistrar);
    const contract='@mozilla.org/filepicker;1';const prior=registrar.contractIDToCID(contract);const cid=Services.uuid.generateUUID();
    const state={runtime,bridge,abort,errors,leaf:'mv2',choice:Ci.nsIFilePicker.returnOK,registrar,prior,cid,contract};
    const factory={QueryInterface:ChromeUtils.generateQI(['nsIFactory']),createInstance(iid){return {
      QueryInterface:ChromeUtils.generateQI(['nsIFilePicker']),init(){},appendFilter(){},
      get file(){return file(state.leaf);},open(callback){window.setTimeout(()=>callback.done(state.choice),0);}
    }.QueryInterface(iid);}};
    state.factory=factory;registrar.registerFactory(cid,'Fennevia local fixture selection',contract,factory);
    window.fenneviaLocalFixture=state;return true;
  `,
  );
  for (let attempt = 0; attempt < 100; attempt++) {
    const snapshot = await execute(
      client,
      "return window.fenneviaLocalFixture.bridge.snapshot();",
    );
    if (snapshot.status !== "starting" && !snapshot.busy) return snapshot;
    await delay(50);
  }
  throw new Error("FENNEVIA_LOCAL_RUNTIME_START_TIMEOUT");
};
const request = (client, value) =>
  execute(
    client,
    `return window.fenneviaLocalFixture.bridge.request(${JSON.stringify(value)});`,
  );
const snapshot = (client) =>
  execute(client, "return window.fenneviaLocalFixture.bridge.snapshot();");
const cleanup = (client) =>
  execute(
    client,
    `
  const state=window.fenneviaLocalFixture;if(!state)return true;
  state.registrar.unregisterFactory(state.cid,state.factory);state.registrar.registerFactory(state.prior,'',state.contract,null);
  state.abort.abort();await state.runtime.stop(true);Services.io.getProtocolHandler("resource").QueryInterface(Ci.nsIResProtocolHandler).setSubstitution("fennevia-local-test",null);delete window.fenneviaLocalFixture;return true;
`,
  );
const row = async (client) => (await snapshot(client)).rows[0];

async function main() {
  const args = process.argv.slice(2);
  assert.equal(args.length, 4);
  assert.equal(args[0], "--firefox");
  assert.equal(args[2], "--profile");
  const [, firefox, , profile] = args;
  await prepare(firefox, profile);
  const source = path.join(profile, "fennevia-local-extension-fixtures", "mv2");
  const fixtureFiles = await Promise.all(
    ["manifest.json", "background.js", "probe.html", "probe.js"].map(
      async (name) => [name, await readFile(path.join(source, name), "utf8")],
    ),
  );
  const junction = path.join(
    profile,
    "fennevia-local-extension-fixtures",
    "junction",
  );
  await symlink(source, junction, "junction");
  const evidence = [];
  let firstUuid;
  for (let boot = 1; boot <= 3; boot++) {
    await openSession(firefox, profile, async (client) => {
      try {
        phase = `boot-${boot}-initialize`;
        const initial = await initialize(client);
        assert.equal(initial.status, "ready");
        const result = { boot };
        if (boot === 1) {
          phase = "junction";
          await execute(
            client,
            "window.fenneviaLocalFixture.leaf='junction';return true;",
          );
          const junctionStatus = (
            await request(client, {
              type: "prepare",
              source: "folder",
              title: "Junction test",
            })
          ).status;
          console.log(JSON.stringify({ junctionStatus }));
          result.junctionRejected = junctionStatus === "unsupported-location";
          assert.equal(result.junctionRejected, true);
          await execute(
            client,
            "window.fenneviaLocalFixture.leaf='mv2';return true;",
          );
          phase = "cancel";
          const preview = await request(client, {
            type: "prepare",
            source: "folder",
            title: "Add test",
          });
          if (preview.status !== "preview")
            console.log(JSON.stringify({ prepareStatus: preview.status }));
          assert.equal(preview.status, "preview");
          assert.ok(preview.required.includes("permission:storage"));
          assert.ok(preview.optional.includes("permission:bookmarks"));
          assert.equal(JSON.stringify(preview).includes(id), false);
          assert.equal(
            (await request(client, { type: "cancel" })).status,
            "cancelled",
          );
          result.cancelNoInstall = await execute(
            client,
            `return !(await AddonManager.getAddonByID('${id}'));`,
          );
          phase = "import";
          const accepted = await request(client, {
            type: "prepare",
            source: "folder",
            title: "Add test",
          });
          const installed = await request(client, {
            type: "confirm",
            token: accepted.token,
          });
          if (installed.status !== "done")
            console.log(JSON.stringify({ installStatus: installed.status }));
          assert.equal(installed.status, "done");
        } else {
          result.automaticRestore =
            initial.rows.length === 1 && initial.rows[0].state === "loaded";
          assert.equal(result.automaticRestore, true);
        }
        phase = `boot-${boot}-state`;
        const state = await waitForFixture(client, 2, boot);
        result.storageBoots = state.boots;
        result.installEvents = state.installs;
        if (boot > 1) {
          result.optionalRetained = state.optional;
          assert.equal(state.optional, true);
        }
        const uuid = await execute(
          client,
          `return ExtensionParent.GlobalManager.getExtension('${id}').uuid;`,
        );
        firstUuid ??= uuid;
        result.uuidStable = uuid === firstUuid;
        assert.equal(result.uuidStable, true);
        result.rows = (await snapshot(client)).rows.length;
        await client.request("Marionette:SetContext", { value: "content" });
        await client.request("WebDriver:Navigate", { url: "about:blank" });
        await client.request("Marionette:SetContext", { value: "chrome" });
        if (boot === 1)
          await execute(
            client,
            `const extension=ExtensionParent.GlobalManager.getExtension('${id}');await ExtensionPermissions.add('${id}',{permissions:['bookmarks'],origins:[]},extension);return true;`,
          );
        if (boot === 2) {
          phase = "disable";
          assert.equal(
            (
              await request(client, {
                type: "disable",
                token: (await row(client)).token,
              })
            ).status,
            "done",
          );
          result.nativeDisabled = await execute(
            client,
            `return (await AddonManager.getAddonByID('${id}')).userDisabled;`,
          );
          assert.equal(result.nativeDisabled, true);
          phase = "enable";
          assert.equal(
            (
              await request(client, {
                type: "enable",
                token: (await row(client)).token,
              })
            ).status,
            "done",
          );
          phase = "update";
          await execute(
            client,
            "window.fenneviaLocalFixture.leaf='mv2-update';return true;",
          );
          const preview = await request(client, {
            type: "prepare",
            source: "folder",
            title: "Update test",
            token: (await row(client)).token,
          });
          assert.equal(preview.status, "preview");
          assert.equal(preview.update, true);
          assert.equal(
            (await request(client, { type: "confirm", token: preview.token }))
              .status,
            "done",
          );
          result.versionUpdated = (await row(client)).version === "2.0";
          assert.equal(result.versionUpdated, true);
        }
        if (boot === 3) {
          phase = "remove";
          assert.equal(
            (
              await request(client, {
                type: "remove",
                token: (await row(client)).token,
              })
            ).status,
            "done",
          );
          result.removed =
            (await snapshot(client)).rows.length === 0 &&
            (await execute(
              client,
              `return !(await AddonManager.getAddonByID('${id}'));`,
            ));
          assert.equal(result.removed, true);
          phase = "archive";
          await execute(
            client,
            `
            for(const [leaf,prefix] of [['valid.zip',''],['wrapped.zip','wrapper/']]){
              const writer=Cc['@mozilla.org/zipwriter;1'].createInstance(Ci.nsIZipWriter);
              writer.open(file(leaf),0x04|0x08|0x20);
              try{for(const name of ['manifest.json','background.js','probe.html','probe.js']){const source=file('mv3');source.append(name);writer.addEntryFile(prefix+name,Ci.nsIZipWriter.COMPRESSION_DEFAULT,source,false);}}finally{writer.close();}
            }
            window.fenneviaLocalFixture.leaf='wrapped.zip';return true;
          `,
          );
          result.wrappedArchiveRejected =
            (
              await request(client, {
                type: "prepare",
                source: "file",
                title: "Archive test",
              })
            ).status === "invalid";
          assert.equal(result.wrappedArchiveRejected, true);
          await execute(
            client,
            "window.fenneviaLocalFixture.leaf='valid.zip';return true;",
          );
          const archive = await request(client, {
            type: "prepare",
            source: "file",
            title: "Archive test",
          });
          assert.equal(archive.status, "preview");
          result.archiveInstalled =
            (await request(client, { type: "confirm", token: archive.token }))
              .status === "done";
          assert.equal(result.archiveInstalled, true);
          assert.equal(
            (
              await request(client, {
                type: "remove",
                token: (await row(client)).token,
              })
            ).status,
            "done",
          );
          phase = "foreign";
          await execute(
            client,
            "await AddonManager.installTemporaryAddon(file('mv3'));window.fenneviaLocalFixture.leaf='mv3';return true;",
          );
          result.foreignRejected =
            (
              await request(client, {
                type: "prepare",
                source: "folder",
                title: "Conflict test",
              })
            ).status === "conflict";
          assert.equal(result.foreignRejected, true);
          result.foreignStillActive = await execute(
            client,
            "return (await AddonManager.getAddonByID('fennevia-local-spike-mv3@example.invalid')).isActive;",
          );
          assert.equal(result.foreignStillActive, true);
        }
        evidence.push(result);
        console.log(JSON.stringify(result));
      } finally {
        await cleanup(client);
      }
    });
    if (boot === 1) {
      // Remove only the four fixture files created above, then their empty directory.
      // No recursive deletion and no original user source is ever selected by this test.
      await unlink(junction);
      for (const [name] of fixtureFiles) await unlink(path.join(source, name));
      await rmdir(source);
      const update = path.join(
        profile,
        "fennevia-local-extension-fixtures",
        "mv2-update",
      );
      await mkdir(update);
      for (const [name, text] of fixtureFiles)
        await writeFile(
          path.join(update, name),
          name === "manifest.json"
            ? JSON.stringify({ ...JSON.parse(text), version: "2.0" })
            : text,
        );
    }
  }
  await writeFile(
    path.join(profile, "fennevia-local-runtime-evidence.json"),
    JSON.stringify(evidence, null, 2),
  );
}
try {
  await main();
} catch (error) {
  console.error(
    JSON.stringify({
      phase,
      code: /^FENNEVIA_[A-Z_]+$/.test(String(error?.message))
        ? error.message
        : "FENNEVIA_LOCAL_RUNTIME_FAILED",
      frame: String(error?.stack).match(
        /firefox-local-extensions-runtime\.mjs:\d+:\d+/,
      )?.[0],
    }),
  );
  process.exitCode = 1;
}
