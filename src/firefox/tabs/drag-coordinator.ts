// SPDX-License-Identifier: MPL-2.0
import type { FirefoxWindowKind } from "../bridge-boundary.ts";
import type { NativeTab } from "./support.ts";

const DRAG_ID_PATTERN = /^tab-transfer-[A-Za-z0-9-]{8,128}$/u;

export type FirefoxTabDragTransfer = Readonly<{
  id: string;
  isActive: () => boolean;
  movingTabs: readonly NativeTab[];
  pinned: boolean;
  sourceContextId: string;
  sourceWindowKind: FirefoxWindowKind;
  tab: NativeTab;
}>;

export type FirefoxTabDragInspection = Readonly<{
  count: number;
  id: string;
  pinned: boolean;
  source: "other-window" | "same-window";
}>;

export type FirefoxTabDragEndResolution =
  | Readonly<{ status: "active"; transfer: FirefoxTabDragTransfer }>
  | Readonly<{ status: "cancelled" | "consumed" | "missing" }>;

export type FirefoxTabDragCoordinator = Readonly<{
  begin: (transfer: Omit<FirefoxTabDragTransfer, "id">) => string;
  cancel: (id: string, sourceContextId: string) => boolean;
  cancelContext: (sourceContextId: string) => boolean;
  consume: (id: string) => boolean;
  inspect: (
    target: Readonly<{
      contextId: string;
      windowKind: FirefoxWindowKind;
    }>,
  ) => FirefoxTabDragInspection | null;
  resolve: (
    target: Readonly<{
      contextId: string;
      windowKind: FirefoxWindowKind;
    }>,
  ) => FirefoxTabDragTransfer | null;
  resolveForEnd: (
    id: string,
    sourceContextId: string,
  ) => FirefoxTabDragEndResolution;
  snapshot: () => Readonly<{
    active: boolean;
    activeId: string | null;
    completedId: string | null;
    completedOutcome: "cancelled" | "consumed" | null;
    sourceContextId: string | null;
  }>;
}>;

const createCoordinatorError = (code: string): Error => {
  const error = new Error(code);
  error.name = "FenneviaTabDragCoordinatorError";
  Object.defineProperties(error, {
    fenneviaCode: { enumerable: false, value: code },
    fenneviaPhase: { enumerable: false, value: "firefox-tab-drag" },
  });
  return error;
};

export function createFirefoxTabDragCoordinator({
  createToken,
}: Readonly<{
  createToken: () => string;
}>): FirefoxTabDragCoordinator {
  if (typeof createToken !== "function") {
    throw createCoordinatorError("FENNEVIA_TAB_DRAG_TOKEN_FACTORY_INVALID");
  }

  let active: FirefoxTabDragTransfer | null = null;
  let completed: Readonly<{
    id: string;
    outcome: "cancelled" | "consumed";
  }> | null = null;

  const complete = (
    transfer: FirefoxTabDragTransfer,
    outcome: "cancelled" | "consumed",
  ): void => {
    active = null;
    completed = Object.freeze({ id: transfer.id, outcome });
  };

  const requireLiveActive = (): FirefoxTabDragTransfer | null => {
    if (!active) {
      return null;
    }
    let live: boolean;
    try {
      live = active.isActive() === true;
    } catch {
      live = false;
    }
    if (!live) {
      const stale = active;
      complete(stale, "cancelled");
      return null;
    }
    return active;
  };

  const resolve = ({
    contextId,
    windowKind,
  }: Readonly<{
    contextId: string;
    windowKind: FirefoxWindowKind;
  }>): FirefoxTabDragTransfer | null => {
    const transfer = requireLiveActive();
    if (
      !transfer ||
      transfer.sourceWindowKind !== windowKind ||
      typeof contextId !== "string" ||
      contextId.length === 0
    ) {
      return null;
    }
    return transfer;
  };

  return Object.freeze({
    begin(candidate): string {
      if (
        !candidate ||
        typeof candidate !== "object" ||
        typeof candidate.sourceContextId !== "string" ||
        candidate.sourceContextId.length === 0 ||
        (candidate.sourceWindowKind !== "normal" &&
          candidate.sourceWindowKind !== "private") ||
        typeof candidate.pinned !== "boolean" ||
        typeof candidate.isActive !== "function" ||
        !candidate.tab ||
        typeof candidate.tab !== "object" ||
        (candidate.movingTabs !== undefined &&
          (!Array.isArray(candidate.movingTabs) ||
            candidate.movingTabs.length === 0 ||
            candidate.movingTabs.length > 1000 ||
            candidate.movingTabs.some(
              (tab) => !tab || typeof tab !== "object",
            )))
      ) {
        throw createCoordinatorError("FENNEVIA_TAB_DRAG_SOURCE_INVALID");
      }
      if (requireLiveActive()) {
        throw createCoordinatorError("FENNEVIA_TAB_DRAG_ALREADY_ACTIVE");
      }
      const id = createToken();
      if (typeof id !== "string" || !DRAG_ID_PATTERN.test(id)) {
        throw createCoordinatorError("FENNEVIA_TAB_DRAG_TOKEN_INVALID");
      }
      completed = null;
      const movingTabs = Object.freeze(
        Array.isArray(candidate.movingTabs) && candidate.movingTabs.length > 0
          ? candidate.movingTabs.slice()
          : [candidate.tab],
      );
      active = Object.freeze({ id, ...candidate, movingTabs });
      return id;
    },

    cancel(id: string, sourceContextId: string): boolean {
      const transfer = requireLiveActive();
      if (
        !transfer ||
        transfer.id !== id ||
        transfer.sourceContextId !== sourceContextId
      ) {
        return false;
      }
      complete(transfer, "cancelled");
      return true;
    },

    cancelContext(sourceContextId: string): boolean {
      const transfer = active;
      if (!transfer || transfer.sourceContextId !== sourceContextId) {
        return false;
      }
      complete(transfer, "cancelled");
      return true;
    },

    consume(id: string): boolean {
      const transfer = active;
      if (!transfer || transfer.id !== id) {
        return false;
      }
      complete(transfer, "consumed");
      return true;
    },

    inspect(target): FirefoxTabDragInspection | null {
      const transfer = resolve(target);
      return transfer
        ? Object.freeze({
            count: transfer.movingTabs.length,
            id: transfer.id,
            pinned: transfer.pinned,
            source:
              transfer.sourceContextId === target.contextId
                ? "same-window"
                : "other-window",
          })
        : null;
    },

    resolve,

    resolveForEnd(
      id: string,
      sourceContextId: string,
    ): FirefoxTabDragEndResolution {
      const transfer = requireLiveActive();
      if (transfer?.id === id && transfer.sourceContextId === sourceContextId) {
        return Object.freeze({ status: "active", transfer });
      }
      if (completed?.id === id) {
        return Object.freeze({ status: completed.outcome });
      }
      return Object.freeze({ status: "missing" });
    },

    snapshot() {
      return Object.freeze({
        active: active !== null,
        activeId: active?.id ?? null,
        completedId: completed?.id ?? null,
        completedOutcome: completed?.outcome ?? null,
        sourceContextId: active?.sourceContextId ?? null,
      });
    },
  });
}
