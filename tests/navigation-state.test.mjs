import assert from "node:assert/strict";
import test from "node:test";

import { createAddressPopupController } from "../src/app/address-popup.ts";
import {
  createBrowserNavigationState,
  createBrowserNavigationStateAdapter,
  maximumNavigationAddressLength,
  maximumNavigationDisplayUriLength,
  maximumNavigationTitleLength,
  reduceBrowserNavigationState,
} from "../src/app/navigation-state.ts";

const initialSnapshot = Object.freeze({
  addressValue: "example.invalid/start",
  canGoBack: false,
  canGoForward: true,
  connectionSecurity: "secure",
  displayUri: "https://example.invalid/start",
  loading: false,
  title: "Start",
  trackingProtection: "blocking",
});

function createBridge() {
  const calls = [];
  const listeners = new Set();
  const addressPopupListeners = new Set();
  let snapshot = initialSnapshot;
  return {
    bridge: Object.freeze({
      back() {
        calls.push("back");
        return true;
      },
      focusContent() {
        calls.push("focus-content");
        return true;
      },
      forward() {
        calls.push("forward");
        return true;
      },
      newTab() {
        calls.push("new-tab");
        return true;
      },
      reload() {
        calls.push("reload");
        return true;
      },
      reloadOrStop() {
        const action = snapshot.loading ? "stop" : "reload";
        calls.push(action);
        return action;
      },
      snapshot: () => snapshot,
      stop() {
        calls.push("stop");
        return true;
      },
      submitAddress(value) {
        calls.push(`submit-address:${value}`);
        if (/^javascript:/iu.test(value.trim())) {
          return Object.freeze({
            reason: "unsafe-scheme",
            status: "rejected",
          });
        }
        return value.trim()
          ? Object.freeze({ status: "accepted" })
          : Object.freeze({ reason: "empty", status: "rejected" });
      },
      subscribe(listener) {
        listeners.add(listener);
        let active = true;
        return () => {
          if (!active) {
            return false;
          }
          active = false;
          listeners.delete(listener);
          return true;
        };
      },
      subscribeAddressPopupOpen(listener) {
        addressPopupListeners.add(listener);
        let active = true;
        return () => {
          if (!active) {
            return false;
          }
          active = false;
          addressPopupListeners.delete(listener);
          return true;
        };
      },
    }),
    calls,
    emit(nextSnapshot, revision) {
      snapshot = Object.freeze(nextSnapshot);
      for (const listener of Array.from(listeners)) {
        listener({ revision, snapshot, type: "snapshot" });
      }
    },
    listenerCount: () => listeners.size,
    addressPopupListenerCount: () => addressPopupListeners.size,
    requestAddressPopup() {
      return Array.from(addressPopupListeners).map((listener) =>
        listener({
          selectAll: true,
          source: "ctrl-l",
          type: "address-popup-open",
        }),
      );
    },
  };
}

function createTabsAdapter() {
  const listeners = new Set();
  let state = Object.freeze({
    revision: 0,
    tabs: Object.freeze([
      Object.freeze({ id: "tab-1", selected: true }),
      Object.freeze({ id: "tab-2", selected: false }),
    ]),
  });
  return {
    adapter: Object.freeze({
      snapshot: () => state,
      subscribe(listener) {
        listeners.add(listener);
        let active = true;
        return () => {
          if (!active) {
            return false;
          }
          active = false;
          listeners.delete(listener);
          return true;
        };
      },
    }),
    select(tabId) {
      state = Object.freeze({
        revision: state.revision + 1,
        tabs: Object.freeze(
          state.tabs.map((tab) =>
            Object.freeze({ ...tab, selected: tab.id === tabId }),
          ),
        ),
      });
      for (const listener of Array.from(listeners)) {
        listener(state);
      }
    },
    listenerCount: () => listeners.size,
  };
}

test("navigation state copies bounded ordinary Firefox-backed data", () => {
  const state = createBrowserNavigationState(
    {
      ...initialSnapshot,
      addressValue: "a".repeat(maximumNavigationAddressLength + 20),
      displayUri: "u".repeat(maximumNavigationDisplayUriLength + 20),
      title: "t".repeat(maximumNavigationTitleLength + 20),
    },
    3,
  );

  assert.equal(state.revision, 3);
  assert.equal(
    state.snapshot.addressValue.length,
    maximumNavigationAddressLength,
  );
  assert.equal(
    state.snapshot.displayUri.length,
    maximumNavigationDisplayUriLength,
  );
  assert.equal(state.snapshot.title.length, maximumNavigationTitleLength);
  assert.ok(Object.isFrozen(state));
  assert.ok(Object.isFrozen(state.snapshot));
  assert.deepEqual(Object.keys(state.snapshot).sort(), [
    "addressValue",
    "canGoBack",
    "canGoForward",
    "connectionSecurity",
    "displayUri",
    "loading",
    "title",
    "trackingProtection",
  ]);
  assert.throws(
    () =>
      createBrowserNavigationState({
        ...initialSnapshot,
        connectionSecurity: "invented",
      }),
    /FENNEVIA_NAVIGATION_STATE_SNAPSHOT_INVALID/u,
  );
});

test("navigation reducer rejects malformed events and ignores stale revisions", () => {
  const state = createBrowserNavigationState(initialSnapshot, 2);
  assert.equal(
    reduceBrowserNavigationState(state, {
      revision: 2,
      snapshot: { ...initialSnapshot, loading: true },
      type: "snapshot",
    }),
    state,
  );
  assert.throws(
    () =>
      reduceBrowserNavigationState(state, {
        revision: 0,
        snapshot: initialSnapshot,
        type: "snapshot",
      }),
    /FENNEVIA_NAVIGATION_STATE_EVENT_INVALID/u,
  );
});

test("navigation adapter forwards actions, popup requests, and revisions", () => {
  const fixture = createBridge();
  const adapter = createBrowserNavigationStateAdapter(fixture.bridge);
  const states = [];
  adapter.subscribe((state) => states.push(state));

  assert.equal(adapter.back(), true);
  assert.equal(adapter.focusContent(), true);
  assert.equal(adapter.forward(), true);
  assert.equal(adapter.reload(), true);
  assert.equal(adapter.stop(), true);
  assert.equal(adapter.newTab(), true);
  assert.equal(adapter.reloadOrStop(), "reload");
  assert.deepEqual(adapter.submitAddress("example.invalid"), {
    status: "accepted",
  });
  const popupRequests = [];
  const unsubscribePopup = adapter.subscribeAddressPopupOpen((request) => {
    popupRequests.push(request);
    return true;
  });
  assert.deepEqual(fixture.requestAddressPopup(), [true]);
  assert.deepEqual(popupRequests, [
    {
      selectAll: true,
      source: "ctrl-l",
      type: "address-popup-open",
    },
  ]);
  assert.equal(unsubscribePopup(), true);
  assert.deepEqual(fixture.calls, [
    "back",
    "focus-content",
    "forward",
    "reload",
    "stop",
    "new-tab",
    "reload",
    "submit-address:example.invalid",
  ]);

  fixture.emit(
    {
      ...initialSnapshot,
      canGoBack: true,
      loading: true,
      title: "Loading",
    },
    1,
  );
  assert.equal(states.length, 1);
  assert.equal(states[0].snapshot.loading, true);
  assert.equal(adapter.reloadOrStop(), "stop");
});

test("navigation adapter validates and disposes its complete public contract", () => {
  const fixture = createBridge();
  for (const member of [
    "back",
    "focusContent",
    "forward",
    "newTab",
    "reload",
    "reloadOrStop",
    "snapshot",
    "stop",
    "submitAddress",
    "subscribe",
    "subscribeAddressPopupOpen",
  ]) {
    assert.throws(
      () =>
        createBrowserNavigationStateAdapter({
          ...fixture.bridge,
          [member]: undefined,
        }),
      /FENNEVIA_NAVIGATION_STATE_BRIDGE_INVALID/u,
    );
  }

  const adapter = createBrowserNavigationStateAdapter(fixture.bridge);
  adapter.subscribe(() => {});
  adapter.subscribeAddressPopupOpen(() => true);
  assert.equal(adapter.dispose(), true);
  assert.equal(adapter.dispose(), false);
  assert.equal(fixture.listenerCount(), 0);
  assert.equal(fixture.addressPopupListenerCount(), 0);
  assert.deepEqual(adapter.status(), {
    addressPopupSubscriberCount: 0,
    disposed: true,
    revision: 0,
    subscriberCount: 0,
  });
  assert.throws(() => adapter.back(), /FENNEVIA_NAVIGATION_STATE_DISPOSED/u);
});

test("address popup owns one draft, preserves it through updates, and discards it on tab change", () => {
  const fixture = createBridge();
  const navigation = createBrowserNavigationStateAdapter(fixture.bridge);
  const tabs = createTabsAdapter();
  const popup = createAddressPopupController({
    navigation,
    tabs: tabs.adapter,
  });

  assert.equal(popup.requestOpen("left-launcher"), "opened");
  assert.equal(popup.snapshot().draftValue, initialSnapshot.addressValue);
  assert.equal(popup.confirmOpen(), true);
  popup.updateDraft("draft search terms");
  fixture.emit({ ...initialSnapshot, title: "Background update" }, 1);
  assert.equal(popup.snapshot().draftValue, "draft search terms");

  assert.deepEqual(popup.submit(), { status: "accepted" });
  assert.equal(popup.snapshot().phase, "submitting");
  fixture.emit(
    {
      ...initialSnapshot,
      addressValue: "search.invalid/result",
      displayUri: "https://search.invalid/result",
    },
    2,
  );
  assert.equal(popup.snapshot().closeReason, "committed");
  assert.equal(popup.completeClose(), true);
  assert.equal(popup.snapshot().draftValue, "");

  popup.requestOpen("ctrl-l");
  popup.confirmOpen();
  popup.updateDraft("second draft");
  tabs.select("tab-2");
  assert.equal(popup.snapshot().closeReason, "tab-changed");
  popup.completeClose();
  assert.equal(popup.snapshot().phase, "hidden");

  popup.requestOpen("left-launcher");
  popup.confirmOpen();
  popup.updateDraft("javascript:alert(1)");
  assert.deepEqual(popup.submit(), {
    reason: "unsafe-scheme",
    status: "rejected",
  });
  assert.equal(popup.snapshot().phase, "invalid");
  assert.equal(popup.snapshot().error, "unsafe-scheme");

  assert.equal(popup.dispose(), true);
  assert.equal(tabs.listenerCount(), 0);
  assert.equal(navigation.dispose(), true);
});
