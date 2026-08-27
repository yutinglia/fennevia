import {
  maximumNavigationAddressLength,
  type AddressSubmissionRejection,
  type AddressSubmissionResult,
  type BrowserNavigationState,
  type BrowserNavigationStateAdapter,
} from "./navigation-state.ts";
import {
  type BrowserTabsState,
  type BrowserTabsStateAdapter,
} from "./tab-state.ts";

export type AddressPopupInvocationSource =
  "ctrl-l" | "tabs-launcher" | "top-launcher";

export type AddressPopupError =
  AddressSubmissionRejection | "submission-failed";

export type AddressPopupPhase =
  | "closing"
  | "disposed"
  | "editing"
  | "failed"
  | "hidden"
  | "invalid"
  | "opening"
  | "submitting";

export type AddressPopupCloseReason =
  | "cancelled"
  | "committed"
  | "environment"
  | "focus-failed"
  | "focus-left"
  | "native-handoff"
  | "outside"
  | "tab-changed";

export type AddressPopupSnapshot = Readonly<{
  closeReason: AddressPopupCloseReason | null;
  draftValue: string;
  error: AddressPopupError | null;
  invocationSource: AddressPopupInvocationSource | null;
  phase: AddressPopupPhase;
  revision: number;
}>;

export type AddressPopupCloseFocusDestination = "content" | "none" | "origin";

export type AddressPopupOpenResult = "opened" | "refocus";

export type AddressPopupController = Readonly<{
  completeClose: () => boolean;
  confirmOpen: () => boolean;
  dispose: () => boolean;
  requestClose: (reason: AddressPopupCloseReason) => boolean;
  requestOpen: (source: AddressPopupInvocationSource) => AddressPopupOpenResult;
  snapshot: () => AddressPopupSnapshot;
  status: () => Readonly<{
    disposed: boolean;
    listenerCount: number;
    navigationSubscribed: boolean;
    tabSubscribed: boolean;
  }>;
  submit: () => AddressSubmissionResult;
  subscribe: (
    listener: (snapshot: AddressPopupSnapshot) => void,
  ) => () => boolean;
  updateDraft: (value: string) => boolean;
}>;

type SubmissionBaseline = Readonly<{
  displayUri: string;
  loading: boolean;
  navigationRevision: number;
}>;

const activePhases = new Set<AddressPopupPhase>([
  "editing",
  "failed",
  "invalid",
  "opening",
  "submitting",
]);

const closeReasons = new Set<AddressPopupCloseReason>([
  "cancelled",
  "committed",
  "environment",
  "focus-failed",
  "focus-left",
  "native-handoff",
  "outside",
  "tab-changed",
]);

function createAddressPopupError(code: string): Error {
  const error = new Error(code);
  error.name = "FenneviaAddressPopupStateError";
  Object.defineProperties(error, {
    fenneviaCode: { enumerable: false, value: code },
    fenneviaPhase: { enumerable: false, value: "address-popup-state" },
  });
  return error;
}

function selectedTabId(state: BrowserTabsState): string | null {
  return state.tabs.find((tab) => tab.selected)?.id ?? null;
}

function freezeSnapshot(snapshot: AddressPopupSnapshot): AddressPopupSnapshot {
  return Object.freeze({ ...snapshot });
}

export function getAddressPopupCloseFocusDestination(
  snapshot: AddressPopupSnapshot,
  environmentIsNormal: boolean,
): AddressPopupCloseFocusDestination {
  if (
    !environmentIsNormal ||
    snapshot.phase !== "closing" ||
    snapshot.closeReason === "environment" ||
    snapshot.closeReason === "focus-failed" ||
    snapshot.closeReason === "native-handoff"
  ) {
    return "none";
  }
  if (
    snapshot.closeReason === "committed" ||
    snapshot.closeReason === "tab-changed" ||
    snapshot.invocationSource === "tabs-launcher" ||
    snapshot.invocationSource === "top-launcher"
  ) {
    return "content";
  }
  return "origin";
}

export function createAddressPopupController({
  navigation,
  tabs,
}: Readonly<{
  navigation: BrowserNavigationStateAdapter;
  tabs: BrowserTabsStateAdapter;
}>): AddressPopupController {
  if (
    !navigation ||
    typeof navigation.snapshot !== "function" ||
    typeof navigation.submitAddress !== "function" ||
    typeof navigation.subscribe !== "function" ||
    !tabs ||
    typeof tabs.snapshot !== "function" ||
    typeof tabs.subscribe !== "function"
  ) {
    throw createAddressPopupError("FENNEVIA_ADDRESS_POPUP_OPTIONS_INVALID");
  }

  let disposed = false;
  let activeTabId: string | null = null;
  let submissionBaseline: SubmissionBaseline | null = null;
  let snapshot = freezeSnapshot({
    closeReason: null,
    draftValue: "",
    error: null,
    invocationSource: null,
    phase: "hidden",
    revision: 0,
  });
  const listeners = new Set<(snapshot: AddressPopupSnapshot) => void>();

  const requireUsable = (): void => {
    if (disposed) {
      throw createAddressPopupError("FENNEVIA_ADDRESS_POPUP_DISPOSED");
    }
  };

  const publish = (next: Omit<AddressPopupSnapshot, "revision">): boolean => {
    if (
      next.closeReason === snapshot.closeReason &&
      next.draftValue === snapshot.draftValue &&
      next.error === snapshot.error &&
      next.invocationSource === snapshot.invocationSource &&
      next.phase === snapshot.phase
    ) {
      return false;
    }
    snapshot = freezeSnapshot({
      ...next,
      revision: snapshot.revision + 1,
    });
    for (const listener of Array.from(listeners)) {
      listener(snapshot);
    }
    return true;
  };

  const beginClosing = (reason: AddressPopupCloseReason): boolean => {
    if (!activePhases.has(snapshot.phase)) {
      return false;
    }
    submissionBaseline = null;
    return publish({
      ...snapshot,
      closeReason: reason,
      phase: "closing",
    });
  };

  const reconcileNavigation = (state: BrowserNavigationState): void => {
    const baseline = submissionBaseline;
    if (
      snapshot.phase !== "submitting" ||
      !baseline ||
      state.revision <= baseline.navigationRevision
    ) {
      return;
    }
    if (
      state.snapshot.displayUri !== baseline.displayUri ||
      (!baseline.loading && state.snapshot.loading)
    ) {
      beginClosing("committed");
    }
  };

  const reconcileTabs = (state: BrowserTabsState): void => {
    if (
      !activePhases.has(snapshot.phase) ||
      activeTabId === null ||
      selectedTabId(state) === activeTabId
    ) {
      return;
    }
    beginClosing("tab-changed");
  };

  const unsubscribeNavigation = navigation.subscribe(reconcileNavigation);
  const unsubscribeTabs = tabs.subscribe(reconcileTabs);
  if (
    typeof unsubscribeNavigation !== "function" ||
    typeof unsubscribeTabs !== "function"
  ) {
    unsubscribeNavigation?.();
    unsubscribeTabs?.();
    throw createAddressPopupError(
      "FENNEVIA_ADDRESS_POPUP_SUBSCRIPTION_INVALID",
    );
  }
  let navigationSubscribed = true;
  let tabSubscribed = true;

  return Object.freeze({
    completeClose(): boolean {
      requireUsable();
      if (snapshot.phase !== "closing") {
        return false;
      }
      activeTabId = null;
      submissionBaseline = null;
      return publish({
        closeReason: null,
        draftValue: "",
        error: null,
        invocationSource: null,
        phase: "hidden",
      });
    },

    confirmOpen(): boolean {
      requireUsable();
      if (snapshot.phase !== "opening") {
        return false;
      }
      return publish({ ...snapshot, phase: "editing" });
    },

    dispose(): boolean {
      if (disposed) {
        return false;
      }
      disposed = true;
      activeTabId = null;
      submissionBaseline = null;
      if (navigationSubscribed) {
        navigationSubscribed = false;
        unsubscribeNavigation();
      }
      if (tabSubscribed) {
        tabSubscribed = false;
        unsubscribeTabs();
      }
      snapshot = freezeSnapshot({
        closeReason: null,
        draftValue: "",
        error: null,
        invocationSource: null,
        phase: "disposed",
        revision: snapshot.revision + 1,
      });
      for (const listener of Array.from(listeners)) {
        listener(snapshot);
      }
      listeners.clear();
      return true;
    },

    requestClose(reason): boolean {
      requireUsable();
      if (!closeReasons.has(reason)) {
        throw createAddressPopupError(
          "FENNEVIA_ADDRESS_POPUP_CLOSE_REASON_INVALID",
        );
      }
      return beginClosing(reason);
    },

    requestOpen(source): AddressPopupOpenResult {
      requireUsable();
      if (
        source !== "ctrl-l" &&
        source !== "tabs-launcher" &&
        source !== "top-launcher"
      ) {
        throw createAddressPopupError("FENNEVIA_ADDRESS_POPUP_SOURCE_INVALID");
      }
      if (activePhases.has(snapshot.phase)) {
        return "refocus";
      }
      const tabId = selectedTabId(tabs.snapshot());
      if (!tabId) {
        throw createAddressPopupError(
          "FENNEVIA_ADDRESS_POPUP_SELECTED_TAB_MISSING",
        );
      }
      const editableValue = navigation.snapshot().snapshot.editableAddressValue;
      activeTabId = tabId;
      submissionBaseline = null;
      publish({
        closeReason: null,
        draftValue: editableValue.slice(0, maximumNavigationAddressLength),
        error: null,
        invocationSource: source,
        phase: "opening",
      });
      return "opened";
    },

    snapshot: () => snapshot,

    status() {
      return Object.freeze({
        disposed,
        listenerCount: listeners.size,
        navigationSubscribed,
        tabSubscribed,
      });
    },

    submit(): AddressSubmissionResult {
      requireUsable();
      if (
        snapshot.phase !== "editing" &&
        snapshot.phase !== "failed" &&
        snapshot.phase !== "invalid"
      ) {
        throw createAddressPopupError(
          "FENNEVIA_ADDRESS_POPUP_SUBMIT_STATE_INVALID",
        );
      }
      if (snapshot.error === "too-long") {
        publish({ ...snapshot, phase: "invalid" });
        return Object.freeze({ reason: "too-long", status: "rejected" });
      }
      if (snapshot.draftValue.trim().length === 0) {
        publish({ ...snapshot, error: "empty", phase: "invalid" });
        return Object.freeze({ reason: "empty", status: "rejected" });
      }

      const navigationState = navigation.snapshot();
      submissionBaseline = Object.freeze({
        displayUri: navigationState.snapshot.displayUri,
        loading: navigationState.snapshot.loading,
        navigationRevision: navigationState.revision,
      });
      publish({ ...snapshot, error: null, phase: "submitting" });
      let result: AddressSubmissionResult;
      try {
        result = navigation.submitAddress(snapshot.draftValue);
      } catch (error) {
        submissionBaseline = null;
        publish({
          ...snapshot,
          error: "submission-failed",
          phase: "failed",
        });
        throw error;
      }
      if (result.status === "rejected") {
        submissionBaseline = null;
        publish({
          ...snapshot,
          error: result.reason,
          phase: "invalid",
        });
      }
      return result;
    },

    subscribe(listener): () => boolean {
      requireUsable();
      if (typeof listener !== "function") {
        throw createAddressPopupError(
          "FENNEVIA_ADDRESS_POPUP_LISTENER_INVALID",
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

    updateDraft(value): boolean {
      requireUsable();
      if (
        snapshot.phase !== "editing" &&
        snapshot.phase !== "failed" &&
        snapshot.phase !== "invalid"
      ) {
        throw createAddressPopupError(
          "FENNEVIA_ADDRESS_POPUP_EDIT_STATE_INVALID",
        );
      }
      if (typeof value !== "string") {
        throw createAddressPopupError("FENNEVIA_ADDRESS_POPUP_VALUE_INVALID");
      }
      const tooLong = value.length > maximumNavigationAddressLength;
      return publish({
        ...snapshot,
        draftValue: value.slice(0, maximumNavigationAddressLength),
        error: tooLong ? "too-long" : null,
        phase: tooLong ? "invalid" : "editing",
      });
    },
  });
}
