// SPDX-License-Identifier: MPL-2.0
import assert from "node:assert/strict";
import { createDefaultComposableCustomizeLayout } from "../src/firefox/customize-layout.ts";

export async function runSettingsTransferProbe(client, report) {
  const result = await client.execute(`
    return (async () => {
      const picker = window.Cc['@mozilla.org/filepicker;1'].createInstance(window.Ci.nsIFilePicker);
      picker.init(window.browsingContext, 'Fennevia settings test', window.Ci.nsIFilePicker.modeSave);
      picker.appendFilter('JSON', '*.json');
      picker.defaultExtension = 'json';
      const evidence = { nativePicker: typeof picker.open === 'function' };
      const names = ['fennevia.customize.layout', 'fennevia.customize.style', 'fennevia.customize.panels'];
      const readPrefs = () => names.map(name => Services.prefs.prefHasUserValue(name) ? Services.prefs.getStringPref(name) : null);
      const canonical = value => value && typeof value === 'object'
        ? Array.isArray(value) ? value.map(canonical) : Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]))
        : value;
      const original = readPrefs();
      const file = Services.dirsvc.get('ProfD', Ci.nsIFile);
      file.append('fennevia-settings-test-' + window.crypto.randomUUID() + '.json');
      const registrar = Components.manager.QueryInterface(Ci.nsIComponentRegistrar);
      const contract = '@mozilla.org/filepicker;1';
      const priorCID = registrar.contractIDToCID(contract);
      const mockCID = Services.uuid.generateUUID();
      let choice = Ci.nsIFilePicker.returnOK;
      // Test-only selection stub; actual bridge, file I/O, preferences and UI run.
      const factory = {
        QueryInterface: ChromeUtils.generateQI(['nsIFactory']),
        createInstance(iid) {
          return {
            QueryInterface: ChromeUtils.generateQI(['nsIFilePicker']),
            init() {}, appendFilter() {},
            get file() { return file; },
            open(callback) { window.setTimeout(() => callback.done(choice), 0); },
          }.QueryInterface(iid);
        },
      };
      registrar.registerFactory(mockCID, 'Fennevia test file selection', contract, factory);
      const frame = document.getElementById('fennevia-shell-frame-host');
      const find = name => frame.querySelector('[data-fennevia-settings-' + name + ']');
      let phase = 'open';
      const wait = async predicate => {
        const deadline = Date.now() + 5000;
        while (!predicate()) {
          if (Date.now() > deadline) throw new Error('FENNEVIA_SETTINGS_TEST_' + phase.toUpperCase());
          await new Promise(resolve => window.setTimeout(resolve, 20));
        }
      };
      const run = async name => {
        find(name).click();
        await new Promise(resolve => window.setTimeout(resolve, 0));
        await wait(() => find('transfer')?.getAttribute('aria-busy') === 'false' &&
          (find('preview') || find('result')?.textContent.trim()));
      };
      try {
        Services.prefs.setStringPref(names[0], JSON.stringify(${JSON.stringify(createDefaultComposableCustomizeLayout())}));
        await wait(() => frame.querySelector('[data-fennevia-action="customize-shell"]'));
        frame.querySelector('[data-fennevia-action="customize-shell"]').click();
        await wait(() => frame.querySelector('[data-fennevia-customize-tab="panels"]'));
        frame.querySelector('[data-fennevia-customize-tab="panels"]').click();
        await wait(() => find('export'));
        const baseline = JSON.stringify(readPrefs());
        phase = 'export';
        await run('export');
        const exported = JSON.parse(await window.IOUtils.readUTF8(file.path));
        evidence.export = exported.format === 'fennevia-settings' && exported.version === 1 &&
          exported.layout.adopted.length === 0 && !!exported.style && !!exported.panels && JSON.stringify(readPrefs()) === baseline;
        phase = 'invalid';
        await window.IOUtils.writeUTF8(file.path, '{');
        await run('import');
        evidence.invalid = !find('preview') && JSON.stringify(readPrefs()) === baseline;
        phase = 'preview';
        exported.style.theme = 'dark';
        exported.style.autoHideDelay = 900;
        exported.style.accent = '#123456';
        exported.panels.allowCompactWindow = true;
        const missingInstance = 'layout-' + exported.layout.nextInstance++;
        exported.layout.zones.top.push({ type: 'item', instanceId: missingInstance,
          target: { source: 'firefox', id: 'fennevia-test-unavailable-widget' } });
        await window.IOUtils.writeUTF8(file.path, JSON.stringify(exported));
        await run('import');
        await wait(() => find('preview'));
        evidence.preview = JSON.stringify(readPrefs()) === baseline && document.activeElement === find('cancel');
        evidence.missing = find('preview').querySelectorAll('p').length === 2;
        phase = 'cancel';
        find('cancel').dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        await wait(() => !find('preview') && !find('import').disabled);
        evidence.cancel = JSON.stringify(readPrefs()) === baseline && document.activeElement === find('import');
        phase = 'apply';
        await run('import');
        await wait(() => find('apply'));
        await run('apply');
        const applied = readPrefs().map(value => JSON.parse(value));
        evidence.apply = applied[1].theme === 'dark' && applied[1].autoHideDelay === 900 &&
          applied[1].accent === '#123456' && applied[2].allowCompactWindow === true;
        evidence.applyLayout = JSON.stringify(canonical(applied[0].zones)) === JSON.stringify(canonical(exported.layout.zones));
        evidence.applyFocus = document.activeElement === find('import');
        phase = 'roundtrip';
        choice = Ci.nsIFilePicker.returnReplace;
        await run('export');
        const roundtrip = JSON.parse(await window.IOUtils.readUTF8(file.path));
        evidence.roundtrip = roundtrip.style.accent === '#123456' && roundtrip.style.autoHideDelay === 900 && roundtrip.panels.allowCompactWindow;
        choice = Ci.nsIFilePicker.returnOK;
        phase = 'stale';
        await run('import');
        await wait(() => find('apply'));
        const changedStyle = { ...applied[1], accent: '#654321' };
        Services.prefs.setStringPref(names[1], JSON.stringify(changedStyle));
        await run('apply');
        evidence.stale = JSON.parse(Services.prefs.getStringPref(names[1])).accent === '#654321' && !find('preview');
        phase = 'picker_cancel';
        const beforeCancel = JSON.stringify(readPrefs());
        choice = Ci.nsIFilePicker.returnCancel;
        await run('import');
        evidence.pickerCancel = !find('preview') && JSON.stringify(readPrefs()) === beforeCancel;
        evidence.active = document.documentElement.hasAttribute('data-fennevia-active');
      } finally {
        frame.querySelector('[data-fennevia-customize-close]')?.click();
        names.forEach((name, index) => {
          if (original[index] === null) Services.prefs.clearUserPref(name);
          else Services.prefs.setStringPref(name, original[index]);
        });
        registrar.unregisterFactory(mockCID, factory);
        registrar.registerFactory(priorCID, '', contract, null);
        await window.IOUtils.remove(file.path, { ignoreAbsent: true });
      }
      evidence.restored = JSON.stringify(readPrefs()) === JSON.stringify(original) &&
        typeof window.Cc[contract].createInstance(window.Ci.nsIFilePicker).open === 'function';
      return evidence;
    })();
  `);
  report(result);
  assert.deepEqual(result, {
    nativePicker: true,
    export: true,
    invalid: true,
    preview: true,
    missing: true,
    cancel: true,
    apply: true,
    applyLayout: true,
    applyFocus: true,
    roundtrip: true,
    stale: true,
    pickerCancel: true,
    active: true,
    restored: true,
  });
  return result;
}
