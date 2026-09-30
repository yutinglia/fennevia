// SPDX-License-Identifier: MPL-2.0
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

// Marker-owned lifecycle harness only. A second real chrome window owns focus;
// pointer boundary events are synthetic, not an OS occlusion/physical-mouse test.
export async function runBackgroundPanelProbe(client, originalHandle) {
  const created = await client.request("WebDriver:NewWindow", {
    focus: true,
    private: false,
    type: "window",
  });
  const other = created.value ?? created;
  assert.equal(other.type, "window");
  let evidence;
  try {
    evidence = await client.execute(`
      return (async () => {
        const wait = ms => new Promise(resolve => window.setTimeout(resolve, ms));
        const active = () => Services.focus.activeWindow === window;
        const waitFor = async (predicate, code) => {
          const deadline = Date.now() + 5000;
          while (!predicate()) {
            if (Date.now() >= deadline) throw new Error(code);
            await wait(20);
          }
        };
        await waitFor(() => !active(), 'FENNEVIA_BACKGROUND_WINDOW_NOT_INACTIVE');
        const result = { session: ${JSON.stringify(randomUUID())}, cases: [] };
        for (const foreground of [false, true]) {
          if (foreground) {
            window.focus();
            await waitFor(active, 'FENNEVIA_BACKGROUND_WINDOW_NOT_REACTIVATED');
          }
          for (const edge of ['top', 'left', 'right', 'bottom']) {
            const root = document.getElementById('fennevia-shell-' + edge + '-root');
            const panel = root.querySelector('[data-fennevia-edge-panel]');
            const trigger = root.querySelector('[data-fennevia-edge-trigger]');
            const phase = () => root.getAttribute('data-fennevia-phase');
            const send = (target, type, relatedTarget, bounds) => target.dispatchEvent(new PointerEvent(type, {
              bubbles: true, cancelable: true, buttons: 0, relatedTarget,
              clientX: (bounds.left + bounds.right) / 2,
              clientY: (bounds.top + bounds.bottom) / 2,
            }));
            send(trigger, 'pointerover', document.documentElement, trigger.getBoundingClientRect());
            await waitFor(() => phase() === 'pointer-revealed', 'FENNEVIA_BACKGROUND_POINTER_NOT_REVEALED');
            // Wait for the existing reveal transition before sampling geometry.
            await wait(250);
            const bounds = panel.getBoundingClientRect();
            const x = (bounds.left + bounds.right) / 2;
            const y = (bounds.top + bounds.bottom) / 2;
            if (x < 0 || y < 0 || x > window.innerWidth || y > window.innerHeight) {
              throw new Error('FENNEVIA_BACKGROUND_PANEL_NOT_IN_VIEWPORT');
            }
            const row = { edge, foreground, activeBefore: active(), before: phase(), trace: [] };
            const disposers = [];
            for (const [target, name, capture] of [
              [window, 'window-capture', true], [panel, 'panel-target', false],
              [root, 'root-bubble', false], [window, 'window-bubble', false],
            ]) {
              const listener = event => {
                if (row.trace.length < 8) row.trace.push({
                  listener: name, eventPhase: event.eventPhase,
                  cancelled: event.cancelBubble, relatedNull: event.relatedTarget === null,
                  active: active(),
                });
              };
              target.addEventListener('pointerout', listener, capture);
              disposers.push(() => target.removeEventListener('pointerout', listener, capture));
            }
            try {
              send(panel, 'pointerout', null, bounds);
              await wait(50);
              row.pending = phase();
              await wait(1050);
              row.after = phase();
              row.activeAfter = active();
              result.cases.push(row);
            } finally {
              for (const dispose of disposers) dispose();
            }
            // A normal in-window exit must still hide in both activation states.
            send(trigger, 'pointerover', document.documentElement, trigger.getBoundingClientRect());
            await waitFor(() => phase() === 'pointer-revealed', 'FENNEVIA_BACKGROUND_POINTER_NOT_REENTERED');
            send(panel, 'pointerout', document.documentElement, bounds);
            await wait(400);
            row.insideExit = phase();
          }
        }
        return result;
      })();
    `);
  } finally {
    await client.request("WebDriver:SwitchToWindow", { handle: other.handle });
    await client.request("WebDriver:CloseWindow");
    await client.request("WebDriver:SwitchToWindow", {
      handle: originalHandle,
    });
    await client.request("Marionette:SetContext", { value: "chrome" });
  }
  assert.equal(evidence.cases.length, 8);
  for (const row of evidence.cases) {
    assert.equal(row.activeBefore, row.foreground);
    assert.equal(row.activeAfter, row.foreground);
    assert.equal(
      row.pending,
      row.foreground ? "pointer-revealed" : "pending-hide",
    );
    assert.equal(
      row.after,
      row.foreground ? "pointer-revealed" : "hidden",
      JSON.stringify(evidence),
    );
    assert.equal(row.insideExit, "hidden");
    assert.deepEqual(
      row.trace.map((event) => event.listener),
      ["window-capture", "panel-target", "root-bubble", "window-bubble"],
    );
  }
  return evidence;
}
