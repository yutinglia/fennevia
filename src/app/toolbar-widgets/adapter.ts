// SPDX-License-Identifier: MPL-2.0

import type {
  BrowserToolbarWidgetsBridge,
  BrowserToolbarWidgetsState,
  BrowserToolbarWidgetsStateAdapter,
  ToolbarWidgetsEditOperation,
} from "./contracts.ts";
import { createToolbarWidgetsStateError } from "./errors.ts";
import {
  createBrowserToolbarWidgetsState,
  reduceBrowserToolbarWidgetsState,
} from "./state.ts";
import { copyToolbarWidgetsEditOperation } from "./validation.ts";

export function createBrowserToolbarWidgetsStateAdapter(
  bridge: BrowserToolbarWidgetsBridge,
): BrowserToolbarWidgetsStateAdapter {
  if (
    !bridge ||
    typeof bridge !== "object" ||
    typeof bridge.edit !== "function" ||
    typeof bridge.invoke !== "function" ||
    typeof bridge.snapshot !== "function" ||
    typeof bridge.subscribe !== "function" ||
    typeof bridge.subscribePopup !== "function"
  ) {
    throw createToolbarWidgetsStateError(
      "FENNEVIA_TOOLBAR_WIDGETS_STATE_BRIDGE_INVALID",
    );
  }

  let activeBridge: BrowserToolbarWidgetsBridge | null = bridge;
  let disposed = false;
  let state = createBrowserToolbarWidgetsState(bridge.snapshot());
  const listeners = new Set<(state: BrowserToolbarWidgetsState) => void>();
  const popupListeners = new Set<(open: boolean) => void>();

  const unsubscribeBridge = bridge.subscribe((event) => {
    if (disposed) {
      return;
    }
    const nextState = reduceBrowserToolbarWidgetsState(state, event);
    if (nextState === state) {
      return;
    }
    state = nextState;
    for (const listener of Array.from(listeners)) {
      listener(state);
    }
  });
  if (typeof unsubscribeBridge !== "function") {
    throw createToolbarWidgetsStateError(
      "FENNEVIA_TOOLBAR_WIDGETS_STATE_SUBSCRIPTION_INVALID",
    );
  }

  const unsubscribePopupBridge = bridge.subscribePopup((event) => {
    if (disposed) {
      return;
    }
    if (event?.type !== "widget-popup" || typeof event.open !== "boolean") {
      throw createToolbarWidgetsStateError(
        "FENNEVIA_TOOLBAR_WIDGETS_STATE_EVENT_INVALID",
      );
    }
    for (const listener of Array.from(popupListeners)) {
      listener(event.open);
    }
  });
  if (typeof unsubscribePopupBridge !== "function") {
    throw createToolbarWidgetsStateError(
      "FENNEVIA_TOOLBAR_WIDGETS_STATE_SUBSCRIPTION_INVALID",
    );
  }

  const requireBridge = (): BrowserToolbarWidgetsBridge => {
    if (disposed || !activeBridge) {
      throw createToolbarWidgetsStateError(
        "FENNEVIA_TOOLBAR_WIDGETS_STATE_DISPOSED",
      );
    }
    return activeBridge;
  };

  return Object.freeze({
    dispose(): boolean {
      if (disposed) {
        return false;
      }
      disposed = true;
      activeBridge = null;
      listeners.clear();
      popupListeners.clear();
      unsubscribePopupBridge();
      unsubscribeBridge();
      return true;
    },

    async edit(operation: ToolbarWidgetsEditOperation): Promise<boolean> {
      const validated = copyToolbarWidgetsEditOperation(operation);
      const result = await requireBridge().edit(validated);
      if (typeof result !== "boolean") {
        throw createToolbarWidgetsStateError(
          "FENNEVIA_TOOLBAR_WIDGETS_STATE_RESULT_INVALID",
        );
      }
      return result;
    },

    async invoke(handle: string, host: unknown): Promise<boolean> {
      if (typeof handle !== "string" || handle === "") {
        throw createToolbarWidgetsStateError(
          "FENNEVIA_TOOLBAR_WIDGETS_STATE_HANDLE_INVALID",
        );
      }
      if (host === undefined || host === null || typeof host !== "object") {
        throw createToolbarWidgetsStateError(
          "FENNEVIA_TOOLBAR_WIDGETS_STATE_HOST_INVALID",
        );
      }
      const result = await requireBridge().invoke(handle, host);
      if (typeof result !== "boolean") {
        throw createToolbarWidgetsStateError(
          "FENNEVIA_TOOLBAR_WIDGETS_STATE_RESULT_INVALID",
        );
      }
      return result;
    },

    snapshot(): BrowserToolbarWidgetsState {
      requireBridge();
      return state;
    },

    status() {
      return Object.freeze({
        disposed,
        popupSubscriberCount: popupListeners.size,
        revision: state.revision,
        subscriberCount: listeners.size,
      });
    },

    subscribe(
      listener: (state: BrowserToolbarWidgetsState) => void,
    ): () => boolean {
      requireBridge();
      if (typeof listener !== "function") {
        throw createToolbarWidgetsStateError(
          "FENNEVIA_TOOLBAR_WIDGETS_STATE_LISTENER_INVALID",
        );
      }
      listeners.add(listener);
      let subscribed = true;
      return Object.freeze(() => {
        if (!subscribed) {
          return false;
        }
        subscribed = false;
        listeners.delete(listener);
        return true;
      });
    },

    subscribePopup(listener: (open: boolean) => void): () => boolean {
      requireBridge();
      if (typeof listener !== "function") {
        throw createToolbarWidgetsStateError(
          "FENNEVIA_TOOLBAR_WIDGETS_STATE_LISTENER_INVALID",
        );
      }
      popupListeners.add(listener);
      let subscribed = true;
      return Object.freeze(() => {
        if (!subscribed) {
          return false;
        }
        subscribed = false;
        popupListeners.delete(listener);
        return true;
      });
    },
  });
}
