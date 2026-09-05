// SPDX-License-Identifier: MPL-2.0
import assert from "node:assert/strict";
import { createServer } from "node:http";

// Runs only inside the marker-owned lifecycle harness. The engine and request
// are synthetic, local, and removed before returning; no browsing data escapes.
export async function runUrlbarCompatibilityProbe(client) {
  const server = createServer((_request, response) => {
    response.writeHead(200, { "Content-Type": "text/html" });
    response.end("<!doctype html><title>Compatibility fixture</title>");
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  try {
    const port = server.address().port;
    const evidence = await client.execute(
      `
      return (async () => {
        const input = document.querySelector('[data-fennevia-address-popup-input]');
        const popup = document.getElementById('fennevia-address-popup-root');
        const list = document.querySelector('[data-fennevia-urlbar-suggestions]');
        const native = gURLBar;
        const controller = native.controller;
        const priorMode = native.searchMode;
        const waitFor = async (predicate, code) => {
          const deadline = Date.now() + 15000;
          while (Date.now() < deadline) {
            if (predicate()) return;
            await new Promise(resolve => window.setTimeout(resolve, 20));
          }
          throw new Error(code);
        };
        const popupClosed = () => popup.hidden || popup.getAttribute('data-fennevia-address-popup-phase') === 'hidden';
        const openDraft = async value => {
          const event = new CustomEvent('command', { bubbles: true, cancelable: true });
          Object.defineProperty(event, 'sourceEvent', { value: { target: { id: 'focusURLBar' } } });
          document.getElementById('Browser:OpenLocation').dispatchEvent(event);
          await waitFor(() => !popupClosed() && document.activeElement === input, 'FENNEVIA_COMPATIBILITY_FOCUS_TIMEOUT');
          input.value = value;
          input.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true, inputType: 'insertText' }));
        };
        const options = () => Array.from(list.querySelectorAll('[role="option"]'));
        const click = element => element.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0, view: window }));
        const result = { pointerCommitted: false, controllerRestored: false, searchCommitted: null, searchModeHandoff: 'not-applicable', fixtureRemoved: true };
        let engine;
        let searchService;
        let previousDefaultEngine;
        try {
          native.view.close();
          native.view.clear?.();
          await openDraft('http://127.0.0.1:${port}/pointer');
          await waitFor(() => options().some(row => row.getAttribute('data-fennevia-suggestion-execution') === 'direct'), 'FENNEVIA_COMPATIBILITY_POINTER_RESULT_TIMEOUT');
          click(options().find(row => row.getAttribute('data-fennevia-suggestion-execution') === 'direct'));
          await waitFor(() => popupClosed() && gBrowser.currentURI.spec === 'http://127.0.0.1:${port}/pointer', 'FENNEVIA_COMPATIBILITY_POINTER_EXECUTION_TIMEOUT');
          result.pointerCommitted = true;
          if (Number.parseInt(Services.appinfo.version, 10) >= 155) {
            ({ SearchService: searchService } = ChromeUtils.importESModule('moz-src:///toolkit/components/search/SearchService.sys.mjs'));
            engine = await searchService.addUserEngine({ name: 'Fennevia compatibility fixture ' + Date.now(), alias: '@fennevia-compatibility', url: 'http://127.0.0.1:${port}/search?q={searchTerms}' });
            result.fixtureRemoved = false;
            await waitFor(() => controller.engineStore.getEngineByName(engine.name), 'FENNEVIA_COMPATIBILITY_ENGINE_TIMEOUT');
            previousDefaultEngine = await searchService.getDefault();
            await searchService.setDefault(engine, searchService.CHANGE_REASON.USER);
            await openDraft('compatibility fixture');
            await waitFor(() => options().some(row => row.getAttribute('data-fennevia-suggestion-execution') === 'direct'), 'FENNEVIA_COMPATIBILITY_SEARCH_RESULT_TIMEOUT');
            click(options().find(row => row.getAttribute('data-fennevia-suggestion-execution') === 'direct'));
            await waitFor(() => {
              const target = new URL(gBrowser.currentURI.spec);
              return popupClosed() && target.origin === 'http://127.0.0.1:${port}' && target.pathname === '/search' && target.searchParams.get('q') === 'compatibility fixture';
            }, 'FENNEVIA_COMPATIBILITY_SEARCH_EXECUTION_TIMEOUT');
            if (native.view.isOpen) throw new Error('FENNEVIA_COMPATIBILITY_UNSOLICITED_NATIVE_VIEW');
            result.searchCommitted = true;
            await openDraft('@fennevia-compatibility');
            await waitFor(() => options().some(row => row.getAttribute('data-fennevia-suggestion-execution') === 'native'), 'FENNEVIA_COMPATIBILITY_MODE_RESULT_TIMEOUT');
            if (native.view.isOpen) throw new Error('FENNEVIA_COMPATIBILITY_UNSOLICITED_NATIVE_VIEW');
            click(options().find(row => row.getAttribute('data-fennevia-suggestion-execution') === 'native'));
            await waitFor(() => popupClosed() && native.focused, 'FENNEVIA_COMPATIBILITY_NATIVE_HANDOFF_TIMEOUT');
            if (native.value !== '@fennevia-compatibility') throw new Error('FENNEVIA_COMPATIBILITY_DRAFT_LOST');
            // openLocation focuses the retained draft; the native Down key owns
            // opening its suggestions and all subsequent search-mode queries.
            native.inputField.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: 'ArrowDown', code: 'ArrowDown', keyCode: 40, view: window }));
            native.inputField.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key: 'ArrowDown', code: 'ArrowDown', keyCode: 40, view: window }));
            await waitFor(() => native.view.visibleResults.some(row => row.payload.engine === engine.name && row.payload.providesSearchMode), 'FENNEVIA_COMPATIBILITY_NATIVE_MODE_RESULT_TIMEOUT');
            const modeResult = native.view.visibleResults.find(row => row.payload.engine === engine.name && row.payload.providesSearchMode);
            native.pickResult({ result: modeResult, event: new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', view: window }) });
            await waitFor(() => native.searchMode?.engineName === engine.name && native.view.isOpen && popupClosed(), 'FENNEVIA_COMPATIBILITY_NATIVE_CONTINUATION_TIMEOUT');
            result.searchModeHandoff = 'passed';
          }
        } finally {
          try {
            if (!popupClosed()) window.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Escape' }));
            native.view.close();
            await native.setSearchMode(priorMode, gBrowser.selectedBrowser);
            native.handleRevert();
          } finally {
            try {
              if (previousDefaultEngine) await searchService.setDefault(previousDefaultEngine, searchService.CHANGE_REASON.USER);
            } finally {
              if (engine) {
                await searchService.removeEngine(engine);
                result.fixtureRemoved = !searchService.getEngineByName(engine.name);
              }
            }
          }
        }
        result.controllerRestored = native.controller === controller;
        return result;
      })();
    `,
      60000,
    );
    assert.equal(evidence.pointerCommitted, true);
    assert.equal(evidence.controllerRestored, true);
    assert.equal(evidence.fixtureRemoved, true);
    assert.equal(
      evidence.searchCommitted,
      evidence.searchModeHandoff === "passed" ? true : null,
    );
    assert.ok(
      ["passed", "not-applicable"].includes(evidence.searchModeHandoff),
    );
    return evidence;
  } finally {
    await new Promise((resolve, reject) => {
      server.closeAllConnections();
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
}
