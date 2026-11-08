// SPDX-License-Identifier: MPL-2.0
/* eslint-disable no-console -- Fixed disposable-profile UI evidence only. */
import assert from "node:assert/strict";
import {
  prepare,
  openSession,
  execute,
} from "./firefox-local-extensions-spike.mjs";

const manifestURI = new URL(
  "../profile/chrome/fennevia/chrome.manifest",
  import.meta.url,
).href;
const args = process.argv.slice(2);
assert.equal(args.length, 4);
assert.equal(args[0], "--firefox");
assert.equal(args[2], "--profile");
const [, firefox, , profile] = args;
try {
  await prepare(firefox, profile);
  await openSession(firefox, profile, async (client) => {
    const evidence = await execute(
      client,
      `
      const registrar=Components.manager.QueryInterface(Ci.nsIComponentRegistrar);
      registrar.autoRegister(Services.io.newURI(${JSON.stringify(manifestURI)}).QueryInterface(Ci.nsIFileURL).file);
      ChromeUtils.importESModule('chrome://fennevia/content/Bootstrap.sys.mjs');
      const wait=async (predicate,phase)=>{for(let i=0;i<200;i++){if(predicate())return;await new Promise(resolve=>window.setTimeout(resolve,25));}throw new Error('FENNEVIA_LOCAL_UI_'+phase);};
      await wait(()=>document.querySelector('[data-fennevia-action="customize-shell"]'),'SHELL');
      const contract='@mozilla.org/filepicker;1';const prior=registrar.contractIDToCID(contract);const cid=Services.uuid.generateUUID();
      const factory={QueryInterface:ChromeUtils.generateQI(['nsIFactory']),createInstance(iid){return {
        QueryInterface:ChromeUtils.generateQI(['nsIFilePicker']),init(){},appendFilter(){},
        get file(){return file('mv2');},open(callback){window.setTimeout(()=>callback.done(Ci.nsIFilePicker.returnOK),0);}
      }.QueryInterface(iid);}};
      registrar.registerFactory(cid,'Fennevia UI fixture picker',contract,factory);
      const find=name=>document.querySelector('[data-fennevia-local-'+name+']');
      const result={};
      try{
        document.querySelector('[data-fennevia-action="customize-shell"]').click();
        await wait(()=>document.querySelector('[data-fennevia-customize-tab="extensions"]'),'TAB');
        document.querySelector('[data-fennevia-customize-tab="extensions"]').click();
        await wait(()=>find('add-folder')&&!find('add-folder').disabled,'READY');
        find('add-folder').focus();find('add-folder').click();
        await wait(()=>find('preview')&&!find('cancel').disabled,'PREVIEW');
        result.cancelFocused=document.activeElement===find('cancel');
        result.noInstallBeforeConsent=!(await AddonManager.getAddonByID('fennevia-local-spike-mv2@example.invalid'));
        find('cancel').dispatchEvent(new window.KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));
        await wait(()=>!find('preview')&&!find('add-folder').disabled,'CANCEL');
        result.focusReturned=document.activeElement===find('add-folder');
        result.cancelStayedInPanel=!!find('add-folder');
        find('add-folder').click();await wait(()=>find('confirm')&&!find('confirm').disabled,'SECOND_PREVIEW');
        find('confirm').click();await wait(()=>!find('preview')&&!find('add-folder').disabled,'CONFIRM');
        result.installed=!!(await AddonManager.getAddonByID('fennevia-local-spike-mv2@example.invalid'));
        result.localizedState=!document.querySelector('[data-fennevia-local-extensions]').textContent.includes('localExtensions.');
        result.shellActive=document.documentElement.hasAttribute('data-fennevia-active');
        document.querySelector('[data-fennevia-customize-close]').click();
        return result;
      }finally{registrar.unregisterFactory(cid,factory);registrar.registerFactory(prior,'',contract,null);}
    `,
    );
    for (const [key, value] of Object.entries(evidence))
      assert.equal(value, true, key);
    console.log(JSON.stringify(evidence));
  });
} catch (error) {
  console.error(
    JSON.stringify({
      code:
        String(error.message).match(/FENNEVIA_[A-Z_]+/)?.[0] ??
        "FENNEVIA_LOCAL_UI_FAILED",
      assertion:
        error.code === "ERR_ASSERTION"
          ? String(error.message).split("\n")[0]
          : undefined,
    }),
  );
  process.exitCode = 1;
}
