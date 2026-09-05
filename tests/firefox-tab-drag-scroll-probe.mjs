// SPDX-License-Identifier: MPL-2.0
import assert from "node:assert/strict";

// Fixed about:blank fixtures in the lifecycle harness's marker-owned profile.
// No page values or native handles are returned to the caller.
export async function runTabDragScrollProbe(client) {
  const evidence = await client.execute(`
    return (async () => {
      const wait = ms => new Promise(resolve => window.setTimeout(resolve, ms));
      const check = (condition, code) => { if (!condition) throw new Error(code); };
      const waitFor = async (condition, code) => {
        const deadline = Date.now() + 10000;
        while (Date.now() < deadline) {
          if (condition()) return;
          await wait(25);
        }
        throw new Error(code);
      };
      const root = document.getElementById('fennevia-shell-left-root');
      const fixtures = [];
      let source;
      let transfer;
      let sourcePoint;
      const send = (target, type, x, y) => {
        if (type === 'dragover' || type === 'drop') {
          target = document.elementFromPoint(x, y);
          check(target?.matches('[data-fennevia-tab-drag-receiver]'), 'FENNEVIA_TAB_SCROLL_RECEIVER_NOT_HIT');
          check(!target.closest('[data-fennevia-tab-partition], [data-fennevia-tab-list]'), 'FENNEVIA_TAB_SCROLL_RECEIVER_INSIDE_SCROLLER');
        }
        return target.dispatchEvent(new DragEvent(type, {
          bubbles: true, cancelable: true, view: window, dataTransfer: transfer,
          clientX: x, clientY: y,
          screenX: window.mozInnerScreenX + x, screenY: window.mozInnerScreenY + y,
        }));
      };
      const cancel = () => {
        if (source) send(source, 'dragend', sourcePoint.x, sourcePoint.y);
        source = null;
        transfer = null;
      };
      try {
        window.dispatchEvent(new KeyboardEvent('keydown', {
          bubbles: true, cancelable: true, altKey: true, ctrlKey: true,
          shiftKey: true, key: 'ArrowLeft',
        }));
        for (let i = 0; i < 40; i++) {
          const tab = gBrowser.addTrustedTab('about:blank', { skipAnimation: true });
          fixtures.push(tab);
          if (i < 8) gBrowser.pinTab(tab);
        }
        await wait(600);
        const partition = root.querySelector('[data-fennevia-tab-partition="regular"]');
        const pinned = root.querySelector('[data-fennevia-tab-partition="pinned"]');
        check(partition && pinned && partition.scrollHeight > partition.clientHeight * 2,
          'FENNEVIA_TAB_SCROLL_FIXTURE_OVERFLOW');
        check(pinned.scrollHeight > pinned.clientHeight, 'FENNEVIA_TAB_SCROLL_PINNED_FIXTURE_OVERFLOW');
        pinned.scrollTop = 36;
        const pinnedPosition = pinned.scrollTop;
        partition.scrollTop = 0;
        const strip = root.querySelector('[data-fennevia-tab-drop-zone]');
        const list = root.querySelector('[data-fennevia-tab-list]');
        const begin = async () => {
          source = partition.querySelector('button[role="tab"]');
          const bounds = source.getBoundingClientRect();
          transfer = new DataTransfer();
          sourcePoint = { x: bounds.left + 8, y: bounds.top + 8 };
          send(source, 'dragstart', sourcePoint.x, sourcePoint.y);
          await wait(50);
          check(list.getAttribute('data-fennevia-drag-active') === 'true',
            'FENNEVIA_TAB_SCROLL_DRAG_NOT_STARTED');
        };
        await begin();
        const bounds = partition.getBoundingClientRect();
        const x = bounds.left + bounds.width / 2;
        const y = bounds.bottom - 1;
        const widthBefore = partition.clientWidth;
        send(partition, 'dragover', x, y);
        check(getComputedStyle(partition).overflowY === 'auto' && getComputedStyle(pinned).overflowY === 'auto',
          'FENNEVIA_TAB_SCROLL_NATIVE_SCROLLBARS_HIDDEN');
        check(!partition.hasAttribute('data-fennevia-tab-scroll-owned') && !pinned.hasAttribute('data-fennevia-tab-scroll-owned'),
          'FENNEVIA_TAB_SCROLL_PARTITION_CLAIMED');
        check(partition.clientWidth === widthBefore, 'FENNEVIA_TAB_SCROLL_GUTTER_CHANGED');
        // Repeated DOM dragovers must not create extra animation loops. Native
        // DragScroll suppression is source-backed and checked through computed
        // receiver ancestry; this fixture does not synthesize an OS drag session.
        for (let i = 0; i < 20; i++) send(partition, 'dragover', x, y);
        await wait(100);
        check(partition.scrollTop < 40, 'FENNEVIA_TAB_SCROLL_NATIVE_SPEED_STACKED');
        const marker = () => root.querySelector('.fennevia-tab-strip__drop-indicator')?.getAttribute('style');
        const initialMarker = marker();
        const early = partition.scrollTop;
        await waitFor(() => partition.scrollTop - early > partition.clientHeight * 0.5, 'FENNEVIA_TAB_SCROLL_LONG_LIST_TOO_SLOW');
        check(marker() !== initialMarker, 'FENNEVIA_TAB_SCROLL_MARKER_STALE');
        check(pinned.scrollTop === pinnedPosition, 'FENNEVIA_TAB_SCROLL_PINNED_MOVED');
        send(partition, 'dragover', x, bounds.top + bounds.height / 2);
        await wait(40);
        const stopped = partition.scrollTop;
        await wait(180);
        check(partition.scrollTop === stopped, 'FENNEVIA_TAB_SCROLL_DID_NOT_STOP');
        send(partition, 'dragover', x, bounds.top + 1);
        await waitFor(() => partition.scrollTop < stopped, 'FENNEVIA_TAB_SCROLL_REVERSE_FAILED');
        cancel();
        await wait(100);
        check(!root.querySelector('[data-fennevia-tab-scroll-owned]') && !root.hasAttribute('data-fennevia-tab-scroll-owned'),
          'FENNEVIA_TAB_SCROLL_OWNERSHIP_LEAK');
        check(getComputedStyle(partition).overflowY === 'auto', 'FENNEVIA_TAB_SCROLL_OVERFLOW_NOT_RESTORED');
        check(!root.querySelector('[data-fennevia-tab-drag-receiver]'), 'FENNEVIA_TAB_SCROLL_RECEIVER_LEAK');

        // Drop after stationary scrolling must use the current geometry.
        partition.scrollTop = 0;
        await begin();
        const beforeOrder = [...gBrowser.openTabs];
        const moving = gBrowser.openTabs.find(tab => !tab.pinned);
        send(partition, 'dragover', x, y);
        await wait(1000);
        send(partition, 'dragover', x, bounds.top + bounds.height / 2);
        await wait(40);
        send(partition, 'drop', x, bounds.top + bounds.height / 2);
        source = null;
        await wait(80);
        check(gBrowser.openTabs.indexOf(moving) > beforeOrder.indexOf(moving), 'FENNEVIA_TAB_SCROLL_DROP_ORDER');
        check(!root.querySelector('[data-fennevia-tab-scroll-owned]'), 'FENNEVIA_TAB_SCROLL_DROP_LEAK');
        check(list.getAttribute('data-fennevia-drag-active') === 'false', 'FENNEVIA_TAB_SCROLL_DROP_ACTIVE');
        check(!root.querySelector('[data-fennevia-tab-drag-receiver]'), 'FENNEVIA_TAB_SCROLL_DROP_RECEIVER_LEAK');

        await begin();
        send(partition, 'dragover', x, y);
        await wait(120);
        send(strip, 'dragleave', 0, 0);
        await wait(80);
        check(!root.querySelector('[data-fennevia-tab-scroll-owned]'), 'FENNEVIA_TAB_SCROLL_LEAVE_LEAK');
        cancel();
        // Keep only about one extra row beyond the visible regular partition.
        const rowSize = partition.querySelector('[data-fennevia-tab-item]').getBoundingClientRect().height +
          parseFloat(getComputedStyle(partition).rowGap);
        const keepRegular = Math.ceil(partition.clientHeight / rowSize) + 1;
        const regularFixtures = fixtures.filter(tab => gBrowser.openTabs.includes(tab) && !tab.pinned);
        for (const tab of regularFixtures.slice(keepRegular - 1)) gBrowser.removeTab(tab, { animate: false });
        await wait(200);
        partition.scrollTop = 0;
        check(partition.scrollHeight > partition.clientHeight && partition.scrollHeight - partition.clientHeight < rowSize * 3,
          'FENNEVIA_TAB_SCROLL_SHORT_FIXTURE_OVERFLOW');
        await begin();
        const shortBounds = partition.getBoundingClientRect();
        send(partition, 'dragover', x, shortBounds.bottom - rowSize * 0.75);
        await waitFor(() => partition.scrollTop > 0, 'FENNEVIA_TAB_SCROLL_SHORT_NO_PROGRESS');
        await wait(200);
        check(partition.scrollTop < rowSize, 'FENNEVIA_TAB_SCROLL_SHORT_OVERSHOT');
        cancel();
        return {
          nativeScrollbarsVisible: true, receiverOutsideScroller: true, gutterStable: true, stationaryPreview: true,
          longListAccelerated: true, immediateStop: true, reverse: true,
          pinnedIsolated: true, dropAfterScroll: true, terminalCleanup: true, shortOverflowControlled: true,
        };
      } finally {
        cancel();
        for (const tab of fixtures) if (gBrowser.openTabs.includes(tab)) gBrowser.removeTab(tab, { animate: false });
      }
    })();
  `);
  assert.deepEqual(evidence, {
    nativeScrollbarsVisible: true,
    receiverOutsideScroller: true,
    gutterStable: true,
    stationaryPreview: true,
    longListAccelerated: true,
    immediateStop: true,
    reverse: true,
    pinnedIsolated: true,
    dropAfterScroll: true,
    terminalCleanup: true,
    shortOverflowControlled: true,
  });
  return evidence;
}
