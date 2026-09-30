// SPDX-License-Identifier: MPL-2.0
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

// Only marker-owned synthetic fixtures. Never return prompt strings, document
// titles, URLs, focus target IDs, or input values from the browser process.
export async function runNativeDialogProbe(client, onDiagnostic = () => {}) {
  const session = randomUUID();
  const prefix = `[Fennevia dialog fixture ${session}] `;
  await client.execute(`
    void (async () => {
      const root = document.documentElement;
      const frame = document.getElementById('fennevia-shell-frame-host');
      const toolbox = document.getElementById('navigator-toolbox');
      const wait = ms => new Promise(resolve => window.setTimeout(resolve, ms));
      const waitFor = async (predicate, code) => {
        const deadline = Date.now() + 8000;
        while (!predicate()) {
          if (Date.now() >= deadline) throw new Error(code);
          await wait(20);
        }
      };
      const sample = () => ({
        active: root.hasAttribute('data-fennevia-active'),
        revealed: root.hasAttribute('data-fennevia-native-ui-revealed'),
        suspended: root.hasAttribute('data-fennevia-native-ui-suspended'),
        toolboxVisible: toolbox.getBoundingClientRect().height > 0,
        shellSuppressed: frame.getAttribute('data-fennevia-environment') === 'native-dialog',
        htmlModal: document.getElementById('window-modal-dialog').open,
        tabModal: Boolean(document.querySelector('#browser browser[tabDialogShowing]')),
      });
      const result = { session: ${JSON.stringify(session)}, cases: [] };
      const findDialog = () => Array.from(document.querySelectorAll('browser.dialogFrame'))
        .map(browser => ({ browser, dialog: browser.contentDocument?.getElementById('commonDialog') }))
        .find(candidate => candidate.dialog && candidate.browser.getBoundingClientRect().height > 0 &&
          getComputedStyle(candidate.browser).visibility === 'visible' &&
          (candidate.browser.closest('#window-modal-dialog')?.open ||
            candidate.browser.closest('.dialogOverlay')?.hasAttribute('topmost')));
      gBrowser.selectedBrowser.focus();
      await wait(250);
      for (const [kind, modalType] of [
        ['tab', Ci.nsIPrompt.MODAL_TYPE_TAB],
        ['content', Ci.nsIPrompt.MODAL_TYPE_CONTENT],
        ['window', Ci.nsIPrompt.MODAL_TYPE_INTERNAL_WINDOW],
      ]) {
        for (const action of ['cancel', 'accept']) {
          const row = { kind, action, before: sample() };
          Services.console.logStringMessage(${JSON.stringify(prefix)} + JSON.stringify({ stage: kind + '-' + action + '-start' }));
          const completion = Services.prompt.asyncConfirm(
            kind === 'window' ? window.browsingContext : gBrowser.selectedBrowser.browsingContext, modalType,
            'Fennevia isolated fixture', 'Synthetic confirmation fixture',
          );
          let opened;
          try {
            await waitFor(() => (opened = findDialog())?.dialog.getButton(action), 'FENNEVIA_DIALOG_FIXTURE_NOT_OPEN');
            await wait(250);
            row.open = sample();
            const button = opened.dialog.getButton(action);
            const bounds = button.getBoundingClientRect();
            row.buttonVisible = bounds.width > 0 && bounds.height > 0 && !button.disabled;
            Services.console.logStringMessage(${JSON.stringify(prefix)} + JSON.stringify({ stage: kind + '-' + action + '-click', visible: row.buttonVisible }));
            button.click();
            const outcome = await completion;
            row.accepted = outcome.getProperty('ok');
            await wait(450);
            row.closed = sample();
            result.cases.push(row);
          } finally {
            const remaining = findDialog();
            if (remaining) remaining.dialog.getButton('cancel').click();
          }
        }
      }
      const interactionPref = 'dom.require_user_interaction_for_beforeunload';
      const hadInteractionPref = Services.prefs.prefHasUserValue(interactionPref);
      const priorInteractionPref = Services.prefs.getBoolPref(interactionPref);
      const fixtureUrl = 'data:text/html;charset=utf-8,' + encodeURIComponent(
        '<!doctype html><title>Fennevia isolated fixture</title><p>Unsaved fixture</p>' +
        '<script>addEventListener("beforeunload", event => { event.preventDefault(); event.returnValue = ""; });</script>',
      );
      try {
        Services.prefs.setBoolPref(interactionPref, false);
        for (const action of ['cancel', 'accept']) {
          Services.console.logStringMessage(${JSON.stringify(prefix)} + JSON.stringify({ stage: 'beforeunload-' + action + '-start' }));
          const tab = gBrowser.addTrustedTab(fixtureUrl, { skipAnimation: true });
          gBrowser.selectedTab = tab;
          try {
            await waitFor(() => tab.linkedBrowser.currentURI.spec === fixtureUrl &&
              !tab.linkedBrowser.webProgress.isLoadingDocument, 'FENNEVIA_BEFOREUNLOAD_FIXTURE_NOT_LOADED');
            await wait(250);
            const row = { kind: 'beforeunload', action, before: sample() };
            Services.console.logStringMessage(${JSON.stringify(prefix)} + JSON.stringify({ stage: 'beforeunload-' + action + '-loaded' }));
            const closeTimer = window.setTimeout(() => gBrowser.removeTab(tab, { animate: false }), 0);
            let opened;
            try {
              await waitFor(() => (opened = findDialog()), 'FENNEVIA_BEFOREUNLOAD_DIALOG_NOT_OPEN');
            } finally {
              window.clearTimeout(closeTimer);
            }
            await wait(250);
            row.open = sample();
            const button = opened.dialog.getButton(action);
            await waitFor(() => !button.disabled, 'FENNEVIA_BEFOREUNLOAD_BUTTON_DISABLED');
            const bounds = button.getBoundingClientRect();
            row.buttonVisible = bounds.width > 0 && bounds.height > 0;
            button.click();
            await waitFor(() => !sample().tabModal && !sample().htmlModal, 'FENNEVIA_BEFOREUNLOAD_DIALOG_NOT_CLOSED');
            await wait(450);
            row.accepted = !gBrowser.tabs.includes(tab);
            row.closed = sample();
            result.cases.push(row);
          } finally {
            const remaining = findDialog();
            if (remaining) remaining.dialog.getButton('cancel').click();
            // Only the exact synthetic tab created above can skip this prompt
            // during fixture cleanup. The observed close path never skips it.
            if (gBrowser.tabs.includes(tab)) gBrowser.removeTab(tab, { animate: false, skipPermitUnload: true });
          }
        }
      } finally {
        if (hadInteractionPref) Services.prefs.setBoolPref(interactionPref, priorInteractionPref);
        else Services.prefs.clearUserPref(interactionPref);
        result.preferenceRestored = Services.prefs.prefHasUserValue(interactionPref) === hadInteractionPref &&
          Services.prefs.getBoolPref(interactionPref) === priorInteractionPref;
      }
      return result;
    })().then(
      evidence => Services.console.logStringMessage(${JSON.stringify(prefix)} + JSON.stringify({ evidence })),
      error => Services.console.logStringMessage(${JSON.stringify(prefix)} + JSON.stringify({
        error: String(error?.message ?? '').match(/FENNEVIA_[A-Z0-9_]+/)?.[0] ?? 'FENNEVIA_DIALOG_FIXTURE_FAILED',
      })),
    );
    return true;
  `);
  // A prompt interrupts a pending Marionette ExecuteScript response. Collect
  // the bounded asynchronous fixture result without a window-global hook.
  let report;
  const deadline = Date.now() + 30000;
  while (!report && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 500));
    try {
      report = await client.execute(`
      const prefix = ${JSON.stringify(prefix)};
      for (const message of Services.console.getMessageArray() ?? []) {
        const text = String(message?.message ?? message ?? '');
        if (text.startsWith(prefix)) {
          const entry = JSON.parse(text.slice(prefix.length));
          if (entry.evidence || entry.error) return entry;
        }
      }
      return null;
      `);
    } catch (error) {
      if (
        error.message !==
        "FENNEVIA_FIREFOX_TEST_REMOTE_UNEXPECTED_ALERT_OPEN_WEBDRIVER_EXECUTESCRIPT"
      )
        throw error;
      // The ignore capability leaves Firefox's dialog untouched while this
      // test-only in-process fixture operates its native buttons.
    }
  }
  if (!report) {
    try {
      await client.request("WebDriver:DismissAlert");
    } catch (error) {
      if (
        error.message !==
        "FENNEVIA_FIREFOX_TEST_REMOTE_NO_SUCH_ALERT_WEBDRIVER_DISMISSALERT"
      )
        throw error;
    }
    const stages = await client.execute(`
      const prefix = ${JSON.stringify(prefix)};
      return (Services.console.getMessageArray() ?? []).map(message => String(message?.message ?? message ?? ''))
        .filter(text => text.startsWith(prefix)).map(text => JSON.parse(text.slice(prefix.length)));
    `);
    onDiagnostic(stages);
    assert.fail("FENNEVIA_DIALOG_FIXTURE_REPORT_TIMEOUT");
  }
  if (report.error) onDiagnostic(report);
  assert.equal(report.error, undefined);
  const evidence = report.evidence;
  assert.equal(evidence.cases.length, 8);
  assert.equal(evidence.preferenceRestored, true);
  for (const row of evidence.cases) {
    assert.equal(row.buttonVisible, true);
    assert.equal(row.accepted, row.action === "accept");
    assert.equal(row.open.active, true);
    assert.equal(row.open.shellSuppressed, true);
    assert.equal(row.open.toolboxVisible, false);
    assert.equal(row.open.revealed, false);
    assert.equal(row.open.suspended, false);
    assert.equal(row.closed.active, true);
    assert.equal(row.closed.toolboxVisible, false);
    assert.equal(row.closed.revealed, false);
    assert.equal(row.closed.suspended, false);
    assert.equal(row.closed.shellSuppressed, false);
    assert.equal(row.closed.tabModal, false);
    assert.equal(row.closed.htmlModal, false);
  }
  return evidence;
}
