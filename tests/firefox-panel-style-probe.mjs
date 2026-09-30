// SPDX-License-Identifier: MPL-2.0
import assert from "node:assert/strict";
import { createDefaultToolbarStyle } from "../src/app/toolbar-widgets-state.ts";

// Only the marker-owned lifecycle harness calls this. Return fixed properties
// and alpha values, never page content, theme identity, or browsing data.
export async function runPanelStyleProbe(client) {
  const defaults = createDefaultToolbarStyle();
  const evidence = await client.execute(`
    return (async () => {
    const frame = document.getElementById('fennevia-shell-frame-host');
    const pref = 'fennevia.customize.style';
    const hadPref = Services.prefs.prefHasUserValue(pref);
    const priorPref = hadPref ? Services.prefs.getStringPref(pref) : null;
    const priorStyle = frame.getAttribute('style');
    const defaults = ${JSON.stringify(defaults)};
    const settle = () => new Promise(resolve => window.setTimeout(resolve, 20));
    const apply = async (theme, overrides = {}) => {
      Services.prefs.setStringPref(pref, JSON.stringify({ ...defaults, ...overrides, theme, version: 1 }));
      const deadline = Date.now() + 5000;
      while (true) {
        const surface = frame.style.getPropertyValue('--fennevia-glass-surface');
        const applied = getComputedStyle(frame).colorScheme === theme &&
          (overrides.surface ? surface.startsWith('rgb(') : overrides.surfaceOpacity ? surface.includes('80%') : surface === '');
        if (applied) return;
        if (Date.now() >= deadline) throw new Error('FENNEVIA_PANEL_STYLE_NOT_APPLIED');
        await settle();
      }
    };
    const canvas = document.createElementNS('http://www.w3.org/1999/xhtml', 'canvas');
    canvas.width = canvas.height = 1;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    const alpha = color => {
      context.clearRect(0, 0, 1, 1);
      context.fillStyle = 'transparent';
      context.fillStyle = color;
      context.fillRect(0, 0, 1, 1);
      return context.getImageData(0, 0, 1, 1).data[3] / 255;
    };
    const sample = () => ({
      panels: Array.from(frame.querySelectorAll('.fennevia-edge-panel'), panel => alpha(getComputedStyle(panel).backgroundColor)),
      address: alpha(getComputedStyle(frame.querySelector('.fennevia-address-popup')).backgroundColor),
    });
    const result = {
      firefoxVersion: Services.appinfo.version,
      buildId: Services.appinfo.appBuildID,
      nova: Services.prefs.getBoolPref('browser.nova.enabled', false),
      toolbarAlpha: alpha(getComputedStyle(frame).getPropertyValue('--toolbar-background-color')),
      cases: [],
      restored: false,
    };
    try {
      for (const theme of ['light', 'dark']) {
        for (const [name, overrides] of [
          ['default', {}],
          ['opacity', { surfaceOpacity: 80 }],
          ['custom-color', { surface: '#314159', surfaceOpacity: 80 }],
        ]) {
          await apply(theme, overrides);
          result.cases.push({ name, theme, ...sample() });
        }
        await apply(theme);
        // Override only the owned frame: native styles and theme remain intact.
        frame.style.setProperty('--toolbar-background-color', 'transparent');
        frame.style.setProperty('--panel-background-color', 'rgb(30 40 50 / 25%)');
        result.cases.push({ name: 'translucent-tokens', theme, ...sample() });
        frame.style.setProperty('--panel-background-color', 'initial');
        frame.style.setProperty('--toolbar-background-color', 'initial');
        result.cases.push({ name: 'missing-tokens', theme, ...sample() });
        frame.style.removeProperty('--panel-background-color');
        frame.style.removeProperty('--toolbar-background-color');
      }
    } finally {
      if (hadPref) Services.prefs.setStringPref(pref, priorPref);
      else Services.prefs.clearUserPref(pref);
      await settle();
      if (priorStyle === null) frame.removeAttribute('style');
      else frame.setAttribute('style', priorStyle);
      result.restored = Services.prefs.prefHasUserValue(pref) === hadPref &&
        (!hadPref || Services.prefs.getStringPref(pref) === priorPref) && frame.getAttribute('style') === priorStyle;
    }
    return result;
    })();
  `);
  assert.equal(evidence.cases.length, 10);
  assert.equal(evidence.restored, true);
  for (const row of evidence.cases) {
    const expected = ["opacity", "custom-color"].includes(row.name)
      ? 0.7
      : 0.82;
    assert.equal(row.panels.length, 4);
    for (const alpha of [...row.panels, row.address]) {
      assert.ok(
        Math.abs(alpha - expected) <= 1 / 255,
        `${row.name}/${row.theme}: floating background opacity ${alpha}`,
      );
    }
  }
  return evidence;
}
