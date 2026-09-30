// SPDX-License-Identifier: MPL-2.0
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createDefaultComposableCustomizeLayout } from "../src/firefox/customize-layout/migration.ts";

export async function runWindowControlLayoutProbe(client, report) {
  // Optional redacted fixture stays local; never return its contents or path.
  const suppliedLayout = process.env.FENNEVIA_LAYOUT_FIXTURE
    ? JSON.parse(
        (await readFile(process.env.FENNEVIA_LAYOUT_FIXTURE, "utf8")).replace(
          /^\uFEFF/u,
          "",
        ),
      )
    : null;
  const result = await client.execute(`
    return (async () => {
      const frame = document.getElementById('fennevia-shell-frame-host');
      const pref = 'fennevia.customize.layout';
      const hadPref = Services.prefs.prefHasUserValue(pref);
      const prior = hadPref ? Services.prefs.getStringPref(pref) : null;
      const defaults = ${JSON.stringify(createDefaultComposableCustomizeLayout())};
      const suppliedLayout = ${JSON.stringify(suppliedLayout)};
      const panels = [...frame.querySelectorAll('.fennevia-edge-panel')];
      const styles = panels.map(panel => panel.getAttribute('style'));
      const evidence = { rows: [], suppliedLayout: [], restored: false };
      const wait = async predicate => {
        const deadline = Date.now() + 5000;
        while (!predicate()) {
          if (Date.now() >= deadline) throw new Error('FENNEVIA_WINDOW_CONTROL_LAYOUT_TIMEOUT');
          await new Promise(resolve => window.setTimeout(resolve, 20));
        }
      };
      try {
        for (const edge of ['top', 'left', 'right']) {
          for (const placement of ['end', 'start', 'middle']) {
          for (const width of [360, 640]) {
          const layout = structuredClone(defaults);
          const items = layout.zones.top.splice(0);
          const windowItems = items.splice(-3);
          items.splice(placement === 'start' ? 0 : placement === 'middle' ? 4 : items.length, 0, ...windowItems);
          const rowId = 'layout-' + layout.nextInstance++;
          const row = { type: 'container', instanceId: rowId, direction: 'row', padding: 'standard', children: items };
          layout.zones[edge].unshift(row);
          Services.prefs.setStringPref(pref, JSON.stringify(layout));
          const panel = frame.querySelector('[data-fennevia-edge-panel="' + edge + '"]');
          panel.style.inlineSize = width + 'px';
          if (edge === 'top') { panel.style.blockSize = '72px'; panel.style.insetInlineEnd = 'auto'; }
          await wait(() => panel.querySelector('[data-fennevia-layout-instance="' + rowId + '"]'));
          window.dispatchEvent(new KeyboardEvent('keydown', { key: edge === 'top' ? 'ArrowUp' : edge === 'left' ? 'ArrowLeft' : 'ArrowRight', ctrlKey: true, shiftKey: true, altKey: true, bubbles: true, cancelable: true }));
          await wait(() => getComputedStyle(panel).opacity === '1');
          const owner = panel.querySelector('[data-fennevia-layout-instance="' + rowId + '"]');
          const scroller = owner.querySelector(':scope > [data-fennevia-layout-container]');
          const nav = owner.querySelector('[data-fennevia-layout-node-content] button:not([data-fennevia-window-control])');
          const navPositions = [];
          for (const position of [0, 100000]) {
            scroller.scrollLeft = position;
            await new Promise(resolve => window.requestAnimationFrame(resolve));
            const bounds = scroller.getBoundingClientRect();
            const controls = [...panel.querySelectorAll('[data-fennevia-window-control]')];
            const navRect = nav.getBoundingClientRect();
            navPositions.push(navRect.left);
            evidence.rows.push({
              edge,
              placement,
              width,
              sameRow: controls.length === 3 && controls.every(control => owner.contains(control)),
              centered: controls.every(control => {
                const rect = control.getBoundingClientRect();
                return Math.abs((rect.top + rect.bottom) / 2 - (navRect.top + navRect.bottom) / 2) <= 1;
              }),
              visible: controls.every(control => {
                const rect = control.getBoundingClientRect();
                return rect.width >= 24 && rect.left >= bounds.left && rect.right <= bounds.right;
              }),
              scrollable: scroller.scrollWidth > scroller.clientWidth,
              hitTest: controls.every(control => {
                const rect = control.getBoundingClientRect();
                return control.contains(document.elementFromPoint((rect.left + rect.right) / 2, (rect.top + rect.bottom) / 2));
              }),
            });
          }
          evidence.rows.at(-1).contentScrolled = navPositions[1] < navPositions[0];
          window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
          }
          }
        }
        if (suppliedLayout) {
          const serialized = JSON.stringify(suppliedLayout);
          Services.prefs.setStringPref(pref, serialized);
          await wait(() => frame.querySelectorAll('[data-fennevia-window-control]').length === 6);
          for (const edge of ['top', 'left']) {
            const panel = frame.querySelector('[data-fennevia-edge-panel="' + edge + '"]');
            panel.style.inlineSize = (edge === 'top' ? 640 : 360) + 'px';
            const row = edge === 'top' ? panel.querySelector('[data-fennevia-composable-layout]') : panel.querySelector('[data-fennevia-layout-instance="' + suppliedLayout.zones.left[0].instanceId + '"]');
            const scroller = edge === 'top' ? row : row.querySelector(':scope > [data-fennevia-layout-container]');
            const controls = [...panel.querySelectorAll('[data-fennevia-window-control]')];
            const nav = row.querySelector('[data-fennevia-layout-node-content] button:not([data-fennevia-window-control])');
            window.dispatchEvent(new KeyboardEvent('keydown', { key: edge === 'top' ? 'ArrowUp' : 'ArrowLeft', ctrlKey: true, shiftKey: true, altKey: true, bubbles: true, cancelable: true }));
            await wait(() => getComputedStyle(panel).opacity === '1');
            for (const position of [0, 100000]) {
              scroller.scrollLeft = position;
              await new Promise(resolve => window.requestAnimationFrame(resolve));
              const bounds = scroller.getBoundingClientRect();
              const navRect = nav.getBoundingClientRect();
              evidence.suppliedLayout.push({
                edge,
                sameRow: controls.length === 3 && controls.every(control => row.contains(control)),
                centered: controls.every(control => { const rect = control.getBoundingClientRect(); return Math.abs((rect.top + rect.bottom - navRect.top - navRect.bottom) / 2) <= 1; }),
                visible: controls.every(control => { const rect = control.getBoundingClientRect(); return rect.width >= 24 && rect.left >= bounds.left && rect.right <= bounds.right; }),
                hitTest: controls.every(control => { const rect = control.getBoundingClientRect(); return control.contains(document.elementFromPoint((rect.left + rect.right) / 2, (rect.top + rect.bottom) / 2)); }),
                unchanged: Services.prefs.getStringPref(pref) === serialized,
              });
            }
            window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
          }
        }
      } finally {
        panels.forEach((panel, index) => {
          if (styles[index] === null) panel.removeAttribute('style');
          else panel.setAttribute('style', styles[index]);
        });
        if (hadPref) Services.prefs.setStringPref(pref, prior); else Services.prefs.clearUserPref(pref);
        evidence.restored = Services.prefs.prefHasUserValue(pref) === hadPref && (!hadPref || Services.prefs.getStringPref(pref) === prior);
      }
      return evidence;
    })();
  `);
  report(result);
  assert.equal(result.restored, true);
  assert.equal(result.rows.length, 36);
  assert.equal(result.suppliedLayout.length, suppliedLayout ? 4 : 0);
  for (const row of result.suppliedLayout) {
    for (const property of [
      "sameRow",
      "centered",
      "visible",
      "hitTest",
      "unchanged",
    ]) {
      assert.equal(
        row[property],
        true,
        `supplied layout/${row.edge}: ${property}`,
      );
    }
  }
  for (const row of result.rows) {
    assert.equal(row.sameRow, true, `${row.edge}: keep configured Row`);
    assert.equal(row.centered, true, `${row.edge}: align control centers`);
    assert.equal(row.visible, true, `${row.edge}: retain visible controls`);
    assert.equal(
      row.scrollable,
      row.width === 360,
      `${row.edge}: allow horizontal scrolling when needed`,
    );
    assert.equal(
      row.hitTest,
      true,
      `${row.edge}/${row.placement}: controls accept pointer input`,
    );
    if (row.contentScrolled !== undefined)
      assert.equal(
        row.contentScrolled,
        row.width === 360,
        `${row.edge}: other widgets scroll`,
      );
  }
}
