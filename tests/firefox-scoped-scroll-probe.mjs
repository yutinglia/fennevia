// SPDX-License-Identifier: MPL-2.0
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createDefaultComposableCustomizeLayout } from "../src/firefox/customize-layout/migration.ts";

export async function runScopedScrollProbe(client, report) {
  const supplied = process.env.FENNEVIA_LAYOUT_FIXTURE
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
      const prior = Services.prefs.prefHasUserValue(pref) ? Services.prefs.getStringPref(pref) : null;
      const defaults = ${JSON.stringify(createDefaultComposableCustomizeLayout())};
      const supplied = ${JSON.stringify(supplied)};
      const panels = [...frame.querySelectorAll('.fennevia-edge-panel')];
      const styles = panels.map(panel => panel.getAttribute('style'));
      const evidence = { cases: [], column: false, tabs: false, drag: [], restored: false };
      const createdTabs = [];
      let phase = 'layout';
      let dragSource;
      let transfer;
      const pause = ms => new Promise(resolve => window.setTimeout(resolve, ms));
      const sendDrag = (target, type, x = 0, y = 0) => target.dispatchEvent(new DragEvent(type, {
        bubbles: true, cancelable: true, view: window, dataTransfer: transfer, clientX: x, clientY: y,
      }));
      const wait = async predicate => {
        const deadline = Date.now() + 5000;
        while (!predicate()) {
          if (Date.now() > deadline) throw new Error('FENNEVIA_SCOPED_SCROLL_TIMEOUT');
          await new Promise(resolve => window.setTimeout(resolve, 20));
        }
      };
      try {
        for (const fixture of supplied ? ['generic', 'nested', 'supplied'] : ['generic', 'nested']) {
          for (const edge of ['left', 'right']) {
          for (const width of [240, 360]) {
            phase = fixture + '-' + edge + '-' + width;
            const layout = structuredClone(fixture === 'supplied' ? supplied : defaults);
            let rowId;
            if (fixture !== 'supplied') {
              rowId = 'layout-' + layout.nextInstance++;
              let row = { instanceId: rowId, type: 'container', direction: 'row', children: layout.zones.top.splice(0) };
              if (fixture === 'nested') {
                // Keep the fixture inside the three-level structural limit.
                row.children = row.children.filter(node => node.type === 'item');
                row = { instanceId: 'layout-' + layout.nextInstance++, type: 'container', direction: 'column', children: [row] };
                row = { instanceId: 'layout-' + layout.nextInstance++, type: 'wrapper', kind: 'padding', children: [row] };
              }
              layout.zones.left.unshift(row);
            } else rowId = layout.zones.left[0].instanceId;
            if (edge === 'right') [layout.zones.left, layout.zones.right] = [layout.zones.right, layout.zones.left];
            const serialized = JSON.stringify(layout);
            Services.prefs.setStringPref(pref, serialized);
            const panel = frame.querySelector('[data-fennevia-edge-panel="' + edge + '"]');
            panel.style.inlineSize = width + 'px';
            await wait(() => panel.querySelector('[data-fennevia-layout-instance="' + rowId + '"]'));
            window.dispatchEvent(new KeyboardEvent('keydown', { key: edge === 'left' ? 'ArrowLeft' : 'ArrowRight', ctrlKey: true, shiftKey: true, altKey: true, bubbles: true, cancelable: true }));
            await wait(() => getComputedStyle(panel).opacity === '1');
            const root = panel.querySelector('[data-fennevia-composable-layout]');
            const row = panel.querySelector('[data-fennevia-layout-instance="' + rowId + '"] > [data-fennevia-layout-container]');
            const address = panel.querySelector('.fennevia-layout-address');
            const tabs = panel.querySelector('.fennevia-tab-strip');
            const nav = row.querySelector('button:not([data-fennevia-window-control])');
            root.scrollLeft = 0; row.scrollLeft = 0;
            const before = [address, tabs, nav].map(node => node.getBoundingClientRect().left);
            root.scrollLeft = 100000; row.scrollLeft = 100000;
            await new Promise(resolve => window.requestAnimationFrame(resolve));
            const after = [address, tabs, nav].map(node => node.getBoundingClientRect().left);
            const bounds = root.getBoundingClientRect();
            evidence.cases.push({
              fixture, edge, width,
              outerBounded: root.scrollWidth <= root.clientWidth + 1 && root.scrollLeft === 0,
              localScrollable: row.scrollWidth > row.clientWidth && row.scrollLeft > 0,
              siblingsFixed: before.slice(0, 2).every((value, index) => Math.abs(value - after[index]) < 1),
              rowContentMoved: after[2] < before[2],
              controlsVisible: [...row.querySelectorAll('[data-fennevia-window-control]')].every(control => {
                const rect = control.getBoundingClientRect();
                return rect.width >= 24 && rect.left >= bounds.left && rect.right <= bounds.right;
              }),
              unchanged: Services.prefs.getStringPref(pref) === serialized,
            });
            window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
          }
          }
        }
        // A height-constrained Column owns vertical overflow independently of
        // its siblings; Tabs keeps its separate native scrolling partition.
        phase = 'column';
        const layout = structuredClone(defaults);
        const columnId = 'layout-' + layout.nextInstance++;
        layout.zones.left.unshift({ instanceId: columnId, type: 'container', direction: 'column', children: layout.zones.top.splice(0) });
        Services.prefs.setStringPref(pref, JSON.stringify(layout));
        const panel = frame.querySelector('[data-fennevia-edge-panel="left"]');
        panel.style.inlineSize = '360px'; panel.style.blockSize = '500px'; panel.style.insetBlockEnd = 'auto';
        await wait(() => panel.querySelector('[data-fennevia-layout-instance="' + columnId + '"]'));
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', ctrlKey: true, shiftKey: true, altKey: true, bubbles: true, cancelable: true }));
        await wait(() => getComputedStyle(panel).opacity === '1');
        const root = panel.querySelector('[data-fennevia-composable-layout]');
        const owner = panel.querySelector('[data-fennevia-layout-instance="' + columnId + '"]');
        owner.style.blockSize = '120px';
        const column = owner.querySelector('[data-fennevia-layout-container]');
        const address = panel.querySelector('.fennevia-layout-address');
        const addressTop = address.getBoundingClientRect().top;
        column.scrollTop = 100000;
        evidence.column = column.scrollTop > 0 && root.scrollTop === 0 && Math.abs(address.getBoundingClientRect().top - addressTop) < 1;
        phase = 'tabs';
        for (let i = 0; i < 18; i++) createdTabs.push(gBrowser.addTrustedTab('about:blank', { skipAnimation: true }));
        const partition = panel.querySelector('[data-fennevia-tab-partition="regular"]');
        await wait(() => partition.scrollHeight > partition.clientHeight);
        const ownerTop = owner.getBoundingClientRect().top;
        partition.scrollTop = 100000;
        evidence.tabs = partition.scrollTop > 0 && root.scrollTop === 0 && Math.abs(owner.getBoundingClientRect().top - ownerTop) < 1 && Math.abs(address.getBoundingClientRect().top - addressTop) < 1;

        phase = 'customize';
        frame.querySelector('[data-fennevia-action="customize-shell"]').click();
        await wait(() => frame.hasAttribute('data-fennevia-customize-active'));
        for (const direction of ['column', 'row']) {
          phase = 'drag-' + direction;
          layout.zones.left[0].direction = direction;
          Services.prefs.setStringPref(pref, JSON.stringify(layout));
          await wait(() => panel.querySelector('[data-fennevia-layout-instance="' + columnId + '"] > [data-fennevia-layout-container="' + direction + '"]'));
          const owner = panel.querySelector('[data-fennevia-layout-instance="' + columnId + '"]');
          owner.style.blockSize = direction === 'column' ? '120px' : '72px';
          const target = owner.querySelector('[data-fennevia-layout-container]');
          const axis = direction === 'row' ? 'scrollLeft' : 'scrollTop';
          target[axis] = 0;
          const children = [...target.children].filter(child => child.hasAttribute('data-fennevia-layout-node'));
          dragSource = children[0]; transfer = new DataTransfer();
          sendDrag(dragSource, 'dragstart');
          await pause(30);
          const bounds = target.getBoundingClientRect();
          const x = (bounds.left + bounds.right) / 2;
          const y = (bounds.top + bounds.bottom) / 2;
          sendDrag(target, 'dragover', x, y);
          await pause(30);
          const firstIndex = Number(target.getAttribute('data-fennevia-layout-drop'));
          target[axis] = 90;
          sendDrag(target, 'dragover', x, y);
          await pause(30);
          const compensated = Number(target.getAttribute('data-fennevia-layout-drop')) > firstIndex;
          const before = target[axis];
          sendDrag(target, 'dragover', direction === 'row' ? bounds.right - 1 : x, direction === 'column' ? bounds.bottom - 1 : y);
          await wait(() => target[axis] > before + 20);
          const local = root.scrollLeft === 0 && root.scrollTop === 0;
          sendDrag(target, 'dragover', x, y);
          await pause(30);
          const stopped = target[axis];
          await pause(120);
          const centerStops = target[axis] === stopped;
          sendDrag(dragSource, 'dragend'); dragSource = null;
          await pause(50);
          evidence.drag.push({ direction, compensated, local, centerStops, cleaned: !target.hasAttribute('data-fennevia-layout-drop') && target[axis] === stopped });
        }
        frame.querySelector('[data-fennevia-customize-close]').click();
        await wait(() => !frame.hasAttribute('data-fennevia-customize-active'));
      } catch {
        evidence.failure = phase;
      } finally {
        if (dragSource) sendDrag(dragSource, 'dragend');
        if (frame.hasAttribute('data-fennevia-customize-active')) frame.querySelector('[data-fennevia-customize-close]').click();
        for (const tab of createdTabs) gBrowser.removeTab(tab, { animate: false, skipPermitUnload: true });
        panels.forEach((panel, index) => {
          if (styles[index] === null) panel.removeAttribute('style');
          else panel.setAttribute('style', styles[index]);
        });
        if (prior === null) Services.prefs.clearUserPref(pref); else Services.prefs.setStringPref(pref, prior);
        evidence.restored = prior === null ? !Services.prefs.prefHasUserValue(pref) : Services.prefs.getStringPref(pref) === prior;
      }
      return evidence;
    })();
  `);
  report(result);
  assert.equal(result.failure, undefined);
  assert.equal(result.restored, true);
  assert.equal(result.cases.length, supplied ? 12 : 8);
  assert.equal(result.column, true);
  assert.equal(result.tabs, true);
  assert.equal(result.drag.length, 2);
  for (const row of result.drag)
    for (const key of ["compensated", "local", "centerStops", "cleaned"])
      assert.equal(row[key], true, `${row.direction}: ${key}`);
  for (const row of result.cases) {
    for (const key of [
      "outerBounded",
      "siblingsFixed",
      "controlsVisible",
      "unchanged",
    ]) {
      assert.equal(row[key], true, `${row.fixture}/${row.width}: ${key}`);
    }
    const overflowing = row.fixture !== "supplied" || row.width === 240;
    assert.equal(
      row.localScrollable,
      overflowing,
      `${row.fixture}/${row.width}: local overflow`,
    );
    assert.equal(
      row.rowContentMoved,
      overflowing,
      `${row.fixture}/${row.width}: row content movement`,
    );
  }
}
