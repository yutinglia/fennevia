// SPDX-License-Identifier: MPL-2.0

import type {
  BrowserToolbarWidgetsState,
  ToolbarWidgetsSnapshot,
  ToolbarWidgetsStateEvent,
} from "./contracts.ts";
import { createToolbarWidgetsStateError } from "./errors.ts";
import { copyToolbarWidgetsSnapshot } from "./validation.ts";

export function createBrowserToolbarWidgetsState(
  snapshot: ToolbarWidgetsSnapshot,
  revision = 0,
): BrowserToolbarWidgetsState {
  if (!Number.isSafeInteger(revision) || revision < 0) {
    throw createToolbarWidgetsStateError(
      "FENNEVIA_TOOLBAR_WIDGETS_STATE_REVISION_INVALID",
    );
  }
  return Object.freeze({
    revision,
    snapshot: copyToolbarWidgetsSnapshot(snapshot),
  });
}

export function reduceBrowserToolbarWidgetsState(
  state: BrowserToolbarWidgetsState,
  event: ToolbarWidgetsStateEvent,
): BrowserToolbarWidgetsState {
  if (
    event?.type !== "snapshot" ||
    !Number.isSafeInteger(event.revision) ||
    event.revision < 1
  ) {
    throw createToolbarWidgetsStateError(
      "FENNEVIA_TOOLBAR_WIDGETS_STATE_EVENT_INVALID",
    );
  }
  if (event.revision <= state.revision) {
    return state;
  }
  return createBrowserToolbarWidgetsState(event.snapshot, event.revision);
}
