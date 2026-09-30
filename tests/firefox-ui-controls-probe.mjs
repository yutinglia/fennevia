// SPDX-License-Identifier: MPL-2.0
import assert from "node:assert/strict";
import { createDefaultComposableCustomizeLayout } from "../src/firefox/customize-layout/migration.ts";

// Test-only fixtures inside the marker-owned browser; return geometry and bounded
// states, never download metadata or bookmark contents.
export async function runUiControlsProbe(client, report) {
  const result = await client.execute(`
    return (async () => {
      const frame = document.getElementById('fennevia-shell-frame-host');
      const pref = 'fennevia.customize.layout';
      const hadPref = Services.prefs.prefHasUserValue(pref);
      const prior = hadPref ? Services.prefs.getStringPref(pref) : null;
      const defaults = ${JSON.stringify(createDefaultComposableCustomizeLayout())};
      const panels = [...frame.querySelectorAll('.fennevia-edge-panel')];
      const priorStyles = panels.map(panel => panel.getAttribute('style'));
      const created = [];
      const { Downloads } = ChromeUtils.importESModule('resource://gre/modules/Downloads.sys.mjs');
      const list = await Downloads.getList(Downloads.PUBLIC);
      const wait = async predicate => {
        const deadline = Date.now() + 5000;
        while (!predicate()) {
          if (Date.now() >= deadline) throw new Error('FENNEVIA_UI_CONTROLS_PROBE_TIMEOUT');
          await new Promise(resolve => window.setTimeout(resolve, 20));
        }
      };
      const button = () => frame.querySelector('[data-fennevia-browser-tool="downloads"]');
      const ring = () => button()?.querySelector('[data-fennevia-download-indicator]');
      const arc = () => ring()?.querySelector('.fennevia-download-indicator__progress');
      const evidence = { downloads: [], windowControls: [], sideScroll: [], bookmarks: false, customize: false, nestedDock: false, restored: false };
      let fixture;
      let phase = 'layout';
      try {
        Services.prefs.setStringPref(pref, JSON.stringify(defaults));
        await wait(() => button());
        phase = 'download-create';
        const create = async (currentBytes, totalBytes, hasProgress) => {
          const item = await Downloads.createDownload({
            source: 'https://example.invalid/fennevia-test-only',
            target: Services.dirsvc.get('TmpD', Ci.nsIFile).path + '/fennevia-ui-test-only.bin',
          });
          Object.assign(item, { currentBytes, totalBytes, hasProgress, progress: 0, stopped: false, succeeded: false, canceled: false });
          created.push(item);
          await list.add(item);
          return item;
        };
        const first = await create(25, 100, true);
        const second = await create(100, 200, true);
        phase = 'download-weighted';
        await wait(() => arc()?.getAttribute('stroke-dasharray') === '41 100');
        evidence.downloads.push(ring().getAttribute('data-fennevia-download-indicator') === 'determinate' && button().getAttribute('aria-label').includes('41%') && ring().getAttribute('aria-hidden') === 'true' &&
          frame.querySelector('.fennevia-downloads__summary-icon .fennevia-download-indicator__progress')?.getAttribute('stroke-dasharray') === '41 100');
        const unknown = await create(7, 0, false);
        phase = 'download-unknown';
        await wait(() => ring()?.getAttribute('data-fennevia-download-indicator') === 'indeterminate');
        evidence.downloads.push(!button().getAttribute('aria-label').includes('%') && arc().getAttribute('stroke-dasharray') === '16 9');
        for (const item of [first, second, unknown]) { item.stopped = true; item.canceled = true; item.hasPartialData = true; item.onchange?.(); }
        phase = 'download-paused';
        await wait(() => !ring());
        evidence.downloads.push(!!button().querySelector('[data-fennevia-firefox-icon="download"]'));
        Object.assign(first, { canceled: false, stopped: false, currentBytes: 0, totalBytes: 100 }); first.onchange?.();
        phase = 'download-zero';
        await wait(() => arc()?.getAttribute('stroke-dasharray') === '0 100');
        evidence.downloads.push(true);
        first.currentBytes = 100; first.onchange?.();
        phase = 'download-complete';
        await wait(() => arc()?.getAttribute('stroke-dasharray') === '100 100');
        evidence.downloads.push(true);
        first.stopped = true; first.succeeded = true; first.onchange?.();
        await wait(() => !ring());
        evidence.downloads.push(true);

        // Reproduce the shared disabled selector with the actual shipped sheet.
        fixture = document.createElementNS('http://www.w3.org/1999/xhtml', 'div');
        fixture.className = 'fennevia-bookmarks';
        for (let i = 0; i < 3; i++) {
          const row = document.createElementNS(fixture.namespaceURI, 'div');
          row.className = 'fennevia-bookmarks__item';
          const control = document.createElementNS(fixture.namespaceURI, 'button');
          control.className = 'fennevia-bookmarks__new-tab'; control.disabled = true;
          row.append(control); fixture.append(row);
        }
        frame.append(fixture);
        evidence.bookmarks = [...fixture.querySelectorAll('button')].every(control => getComputedStyle(control).opacity === '0');

        const top = frame.querySelector('[data-fennevia-edge-panel="top"]');
        const topScroll = top.querySelector('[data-fennevia-composable-layout]');
        top.style.inlineSize = '360px'; top.style.insetInlineEnd = 'auto';
        for (const position of [0, 100000]) {
          topScroll.scrollLeft = position;
          const bounds = top.getBoundingClientRect();
          const controls = [...top.querySelectorAll('[data-fennevia-window-control]')];
          evidence.windowControls.push(controls.length === 3 && controls.every(control => {
            const rect = control.getBoundingClientRect();
            return rect.width >= 24 && rect.left >= bounds.left && rect.right <= bounds.right && !control.disabled;
          }) && topScroll.scrollWidth > topScroll.clientWidth);
        }
        // Nested rows containing fixed-size controls must contribute their width
        // to both side scrollers, including overflow toward the start edge.
        for (const edge of ['left', 'right']) {
          phase = 'side-scroll-' + edge;
          const panel = frame.querySelector('[data-fennevia-edge-panel="' + edge + '"]');
          const scroller = panel.querySelector('[data-fennevia-composable-layout]');
          panel.style.inlineSize = '110px';
          const base = scroller.querySelector('[data-fennevia-layout-base]') ?? scroller;
          const row = document.createElementNS(fixture.namespaceURI, 'div');
          row.className = 'fennevia-layout-container fennevia-layout-container--row';
          for (let i = 0; i < 8; i++) {
            const control = document.createElementNS(fixture.namespaceURI, 'button');
            control.className = 'fennevia-control fennevia-layout-control'; row.append(control);
          }
          base.append(row);
          try {
            scroller.scrollLeft = 0;
            const start = row.firstElementChild.getBoundingClientRect();
            const viewport = scroller.getBoundingClientRect();
            scroller.scrollLeft = 100000;
            const end = row.lastElementChild.getBoundingClientRect();
            evidence.sideScroll.push(scroller.scrollLeft > 0 && start.left >= viewport.left && end.right <= viewport.right && getComputedStyle(scroller).overflowX === 'auto');
          } finally { row.remove(); }
        }
        phase = 'customize';
        frame.querySelector('[data-fennevia-action="customize-shell"]').click();
        await wait(() => frame.hasAttribute('data-fennevia-customize-active'));
        evidence.customize = frame.querySelectorAll('[data-fennevia-window-control]').length === 3 &&
          frame.querySelectorAll('[data-fennevia-window-controls-dock]').length === 0;
        frame.querySelector('[data-fennevia-customize-close]').click();
        await wait(() => !frame.hasAttribute('data-fennevia-customize-active'));
        await wait(() => frame.querySelector('[data-fennevia-window-controls-dock]'));
        evidence.customize &&= frame.querySelectorAll('[data-fennevia-window-control]').length === 3;
        phase = 'nested-dock';
        const moved = structuredClone(defaults);
        const controls = moved.zones.top.splice(-3);
        moved.zones.left.push({ type: 'container', instanceId: 'layout-' + moved.nextInstance++, direction: 'row', children: controls });
        Services.prefs.setStringPref(pref, JSON.stringify(moved));
        const left = frame.querySelector('[data-fennevia-edge-panel="left"]');
        await wait(() => left.querySelectorAll('[data-fennevia-window-control]').length === 3);
        const bounds = left.getBoundingClientRect();
        evidence.nestedDock = frame.querySelectorAll('[data-fennevia-window-control]').length === 3 &&
          [...left.querySelectorAll('[data-fennevia-window-control]')].every(control => {
            const rect = control.getBoundingClientRect();
            return rect.width >= 24 && rect.left >= bounds.left && rect.right <= bounds.right;
          });
      } catch (error) {
        evidence.failure = { phase, name: ['TypeError', 'ReferenceError', 'Error'].includes(error.name) ? error.name : 'other' };
      } finally {
        fixture?.remove();
        for (const item of created) await list.remove(item);
        panels.forEach((panel, index) => {
          if (priorStyles[index] === null) panel.removeAttribute('style');
          else panel.setAttribute('style', priorStyles[index]);
        });
        if (hadPref) Services.prefs.setStringPref(pref, prior); else Services.prefs.clearUserPref(pref);
        evidence.restored = Services.prefs.prefHasUserValue(pref) === hadPref && (!hadPref || Services.prefs.getStringPref(pref) === prior);
      }
      return evidence;
    })();
  `);
  report(result);
  assert.deepEqual(result, {
    downloads: [true, true, true, true, true, true],
    windowControls: [true, true],
    sideScroll: [true, true],
    bookmarks: true,
    customize: true,
    nestedDock: true,
    restored: true,
  });
  return result;
}
