// SPDX-License-Identifier: MPL-2.0
/* eslint-disable no-console -- Disposable-profile release evidence only. */
import assert from "node:assert/strict";
import { mkdtemp, readFile, realpath, writeFile } from "node:fs/promises";
import path from "node:path";
import { execute, openSession } from "./firefox-local-extensions-spike.mjs";

// Requires an already installed, marker-owned program/profile pair. Unlike the
// focused bridge spike this does not import Bootstrap or create a second service.
const args = process.argv.slice(2);
assert.ok(args.length === 4 || args.length === 5);
assert.equal(args[0], "--firefox");
assert.equal(args[2], "--profile");
const [, firefox, , profile] = args;
const interrupt = args.length === 5;
if (interrupt) assert.equal(args[4], "--interrupt-install");
const managed = path.join(process.env.LOCALAPPDATA, "fennevia");
for (const [target, parent] of [
  [profile, path.join(managed, "profiles")],
  [path.dirname(firefox), path.join(managed, "program-spikes")],
]) {
  const relative = path.relative(parent, target);
  assert.ok(
    relative && !relative.startsWith("..") && !path.isAbsolute(relative),
  );
  assert.equal(
    (await realpath(target)).toLowerCase(),
    path.resolve(target).toLowerCase(),
  );
}
const profileMarker = JSON.parse(
  await readFile(path.join(profile, ".fennevia-dev-profile.json"), "utf8"),
);
const programMarker = JSON.parse(
  await readFile(
    path.join(path.dirname(firefox), ".fennevia-program-spike.json"),
    "utf8",
  ),
);
assert.equal(profileMarker.owner, "fennevia");
assert.equal(profileMarker.profileName, "fennevia-dev");
assert.equal(programMarker.owner, "fennevia");
assert.equal(programMarker.purpose, "firefox-identity-regression");
assert.equal(programMarker.state, "ready");
// Use the profile's existing test transport port without changing preferences.
let port = 2828;
for (const leaf of ["prefs.js", "user.js"]) {
  let text;
  try {
    text = await readFile(path.join(profile, leaf), "utf8");
  } catch (error) {
    if (error.code === "ENOENT") continue;
    throw error;
  }
  const values = [
    ...text.matchAll(/^user_pref\("marionette\.port",\s*(\d+)\);$/gm),
  ];
  if (values.length) port = Number(values.at(-1)[1]);
}
const session = (run) => openSession(firefox, profile, run, port);
const fixture = await mkdtemp(
  path.join(profile, "fennevia-release-local-fixture-"),
);
await writeFile(
  path.join(fixture, "manifest.json"),
  JSON.stringify({
    manifest_version: 2,
    name: "Fennevia release startup fixture",
    version: "1.0",
    browser_specific_settings: {
      gecko: { id: "fennevia-release-startup@example.invalid" },
    },
  }),
  { flag: "wx" },
);
const setup = `
  const wait=async(predicate)=>{for(let i=0;i<200;i++){if(await predicate())return;await new Promise(resolve=>window.setTimeout(resolve,25));}throw new Error('FENNEVIA_STARTUP_TIMEOUT');};
  await wait(()=>document.documentElement.hasAttribute('data-fennevia-active'));
  const id='fennevia-release-startup@example.invalid';
  const find=name=>document.querySelector('[data-fennevia-local-'+name+']');
  const panel=async()=>{
    document.querySelector('[data-fennevia-action="customize-shell"]').click();
    await wait(()=>document.querySelector('[data-fennevia-customize-tab="extensions"]'));
    document.querySelector('[data-fennevia-customize-tab="extensions"]').click();
    await wait(()=>find('add-folder')&&!find('add-folder').disabled);
  };
`;
await session(async (client) => {
  const result = await execute(
    client,
    setup +
      `
      if(await AddonManager.getAddonByID(id))throw new Error('FENNEVIA_STARTUP_CONFLICT');
      await panel();
      const registrar=Components.manager.QueryInterface(Ci.nsIComponentRegistrar);
      const contract='@mozilla.org/filepicker;1',prior=registrar.contractIDToCID(contract),cid=Services.uuid.generateUUID();
      const factory={QueryInterface:ChromeUtils.generateQI(['nsIFactory']),createInstance(iid){return {
        QueryInterface:ChromeUtils.generateQI(['nsIFilePicker']),init(){},appendFilter(){},
        get file(){const f=Services.dirsvc.get('ProfD',Ci.nsIFile);f.append(${JSON.stringify(path.basename(fixture))});return f;},
        open(callback){window.setTimeout(()=>callback.done(Ci.nsIFilePicker.returnOK),0);}
      }.QueryInterface(iid);}};
      registrar.registerFactory(cid,'Fennevia release fixture picker',contract,factory);
      try{
        find('add-folder').click();await wait(()=>find('confirm')&&!find('confirm').disabled);
        find('confirm').click();await wait(async()=>!!(await AddonManager.getAddonByID(id))?.isActive);
        if(!${interrupt}){
          await wait(()=>!find('preview')&&!find('add-folder').disabled);
          document.querySelector('[data-fennevia-customize-close]').click();
        }
        return {installed:true,autoConfigActive:true};
      }finally{registrar.unregisterFactory(cid,factory);registrar.registerFactory(prior,'',contract,null);}
    `,
  );
  assert.deepEqual(result, { installed: true, autoConfigActive: true });
  console.log(JSON.stringify({ boot: 1, ...result }));
});
await session(async (client) => {
  // The service is initialized by the first normal window. Operations in a
  // later window must still complete after that original DOM global dies.
  await execute(client, setup + "return true;");
  const originalWindow = await client.request("WebDriver:GetWindowHandle");
  const created = await client.request("WebDriver:NewWindow", {
    focus: true,
    private: false,
    type: "window",
  });
  const second = created.value ?? created;
  await client.request("WebDriver:SwitchToWindow", {
    handle: originalWindow.value ?? originalWindow,
  });
  await client.request("WebDriver:CloseWindow");
  await client.request("WebDriver:SwitchToWindow", { handle: second.handle });
  await client.request("Marionette:SetContext", { value: "chrome" });
  const result = await execute(
    client,
    setup +
      `
      if(!${interrupt})await wait(async()=>!!(await AddonManager.getAddonByID(id))?.isActive);
      await panel();
      const addon=await AddonManager.getAddonByID(id);
      const root=Services.dirsvc.get('ProfD',Ci.nsIFile).path;
      const registry=JSON.parse(await IOUtils.readUTF8(PathUtils.join(root,'fennevia','local-extensions','registry.json')));
      const entry=registry.entries.find(entry=>entry.id===id);
      if(!addon&&!entry?.interrupted)throw new Error('FENNEVIA_STARTUP_STATE_LOST');
      const remove=[...document.querySelectorAll('[data-fennevia-local-extensions] li button')].find(button=>['Remove','移除'].includes(button.textContent.trim()));
      if(!remove)throw new Error('FENNEVIA_STARTUP_REMOVE_MISSING');
      remove.click();await wait(()=>find('confirm')&&!find('confirm').disabled);
      find('confirm').click();await wait(async()=>!(await AddonManager.getAddonByID(id)));
      await wait(()=>!find('preview')&&!find('add-folder').disabled);
      document.querySelector('[data-fennevia-customize-close]').click();
      return {restored:!!addon?.temporarilyInstalled,interrupted:!!entry.interrupted,removed:true,autoConfigActive:true};
    `,
  );
  assert.equal(result.restored || (interrupt && result.interrupted), true);
  assert.equal(result.removed, true);
  assert.equal(result.autoConfigActive, true);
  console.log(JSON.stringify({ boot: 2, firstWindowClosed: true, ...result }));
});
await session(async (client) => {
  const result = await execute(
    client,
    setup +
      `
      await panel();
      document.querySelector('[data-fennevia-customize-close]').click();
      return {removalPersisted:!(await AddonManager.getAddonByID(id)),autoConfigActive:true};
    `,
  );
  assert.deepEqual(result, {
    removalPersisted: true,
    autoConfigActive: true,
  });
  console.log(JSON.stringify({ boot: 3, ...result }));
});
