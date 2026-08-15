export const maximumNavigationTitleLength = 256;
export const maximumNavigationDisplayUriLength = 2_048;
export const maximumNavigationAddressLength = 4_096;

export type AddressPopupOpenRequest = Readonly<{
  selectAll: boolean;
  source: "ctrl-l";
  type: "address-popup-open";
}>;

export type AddressSubmissionRejection = "empty" | "too-long" | "unsafe-scheme";

export type AddressSubmissionResult =
  | Readonly<{ status: "accepted" }>
  | Readonly<{
      reason: AddressSubmissionRejection;
      status: "rejected";
    }>;

export type ConnectionSecurityState =
  | "associated"
  | "certificate-error"
  | "extension"
  | "https-only-error"
  | "internal"
  | "local"
  | "network-error"
  | "not-secure"
  | "secure"
  | "secure-certificate-override"
  | "secure-qualified-certificate"
  | "secure-verified-organization"
  | "unavailable";

export type TrackingProtectionState =
  | "blocking"
  | "detected"
  | "exception"
  | "no-trackers-detected"
  | "unavailable";

const connectionSecurityStates = new Set<ConnectionSecurityState>([
  "associated",
  "certificate-error",
  "extension",
  "https-only-error",
  "internal",
  "local",
  "network-error",
  "not-secure",
  "secure",
  "secure-certificate-override",
  "secure-qualified-certificate",
  "secure-verified-organization",
  "unavailable",
]);

const trackingProtectionStates = new Set<TrackingProtectionState>([
  "blocking",
  "detected",
  "exception",
  "no-trackers-detected",
  "unavailable",
]);

export type NavigationSnapshot = Readonly<{
  addressValue: string;
  canGoBack: boolean;
  canGoForward: boolean;
  connectionSecurity: ConnectionSecurityState;
  displayUri: string;
  loading: boolean;
  title: string;
  trackingProtection: TrackingProtectionState;
}>;

export type NavigationStateEvent = Readonly<{
  revision: number;
  snapshot: NavigationSnapshot;
  type: "snapshot";
}>;

export type BrowserNavigationBridge = Readonly<{
  back: () => boolean;
  focusContent: () => boolean;
  forward: () => boolean;
  newTab: () => boolean;
  reload: () => boolean;
  reloadOrStop: () => "reload" | "stop";
  snapshot: () => NavigationSnapshot;
  stop: () => boolean;
  submitAddress: (value: string) => AddressSubmissionResult;
  subscribe: (listener: (event: NavigationStateEvent) => void) => () => boolean;
  subscribeAddressPopupOpen: (
    listener: (request: AddressPopupOpenRequest) => boolean,
  ) => () => boolean;
}>;

export type BrowserNavigationState = Readonly<{
  revision: number;
  snapshot: NavigationSnapshot;
}>;

export type BrowserNavigationStateAdapter = Readonly<{
  back: () => boolean;
  dispose: () => boolean;
  focusContent: () => boolean;
  forward: () => boolean;
  newTab: () => boolean;
  reload: () => boolean;
  reloadOrStop: () => "reload" | "stop";
  snapshot: () => BrowserNavigationState;
  status: () => Readonly<{
    addressPopupSubscriberCount: number;
    disposed: boolean;
    revision: number;
    subscriberCount: number;
  }>;
  stop: () => boolean;
  submitAddress: (value: string) => AddressSubmissionResult;
  subscribe: (
    listener: (state: BrowserNavigationState) => void,
  ) => () => boolean;
  subscribeAddressPopupOpen: (
    listener: (request: AddressPopupOpenRequest) => boolean,
  ) => () => boolean;
}>;

const createStateError = (code: string): Error => {
  const error = new Error(code);
  error.name = "FenneviaNavigationStateError";
  Object.defineProperties(error, {
    fenneviaCode: { enumerable: false, value: code },
    fenneviaPhase: { enumerable: false, value: "navigation-state" },
  });
  return error;
};

const copyBoundedString = (value: unknown, maximumLength: number): string => {
  if (typeof value !== "string") {
    throw createStateError("FENNEVIA_NAVIGATION_STATE_SNAPSHOT_INVALID");
  }
  return value.slice(0, maximumLength);
};

export function copyNavigationSnapshot(
  candidate: NavigationSnapshot,
): NavigationSnapshot {
  if (
    !candidate ||
    typeof candidate !== "object" ||
    typeof candidate.canGoBack !== "boolean" ||
    typeof candidate.canGoForward !== "boolean" ||
    typeof candidate.loading !== "boolean" ||
    !connectionSecurityStates.has(candidate.connectionSecurity) ||
    !trackingProtectionStates.has(candidate.trackingProtection)
  ) {
    throw createStateError("FENNEVIA_NAVIGATION_STATE_SNAPSHOT_INVALID");
  }

  return Object.freeze({
    addressValue: copyBoundedString(
      candidate.addressValue,
      maximumNavigationAddressLength,
    ),
    canGoBack: candidate.canGoBack,
    canGoForward: candidate.canGoForward,
    connectionSecurity: candidate.connectionSecurity,
    displayUri: copyBoundedString(
      candidate.displayUri,
      maximumNavigationDisplayUriLength,
    ),
    loading: candidate.loading,
    title: copyBoundedString(candidate.title, maximumNavigationTitleLength),
    trackingProtection: candidate.trackingProtection,
  });
}

export function createBrowserNavigationState(
  snapshot: NavigationSnapshot,
  revision = 0,
): BrowserNavigationState {
  if (!Number.isSafeInteger(revision) || revision < 0) {
    throw createStateError("FENNEVIA_NAVIGATION_STATE_REVISION_INVALID");
  }
  return Object.freeze({
    revision,
    snapshot: copyNavigationSnapshot(snapshot),
  });
}

export function reduceBrowserNavigationState(
  state: BrowserNavigationState,
  event: NavigationStateEvent,
): BrowserNavigationState {
  if (
    event?.type !== "snapshot" ||
    !Number.isSafeInteger(event.revision) ||
    event.revision < 1
  ) {
    throw createStateError("FENNEVIA_NAVIGATION_STATE_EVENT_INVALID");
  }
  if (event.revision <= state.revision) {
    return state;
  }
  return createBrowserNavigationState(event.snapshot, event.revision);
}

export function createBrowserNavigationStateAdapter(
  bridge: BrowserNavigationBridge,
): BrowserNavigationStateAdapter {
  if (
    !bridge ||
    typeof bridge !== "object" ||
    typeof bridge.back !== "function" ||
    typeof bridge.focusContent !== "function" ||
    typeof bridge.forward !== "function" ||
    typeof bridge.newTab !== "function" ||
    typeof bridge.reload !== "function" ||
    typeof bridge.reloadOrStop !== "function" ||
    typeof bridge.snapshot !== "function" ||
    typeof bridge.stop !== "function" ||
    typeof bridge.submitAddress !== "function" ||
    typeof bridge.subscribe !== "function" ||
    typeof bridge.subscribeAddressPopupOpen !== "function"
  ) {
    throw createStateError("FENNEVIA_NAVIGATION_STATE_BRIDGE_INVALID");
  }

  let activeBridge: BrowserNavigationBridge | null = bridge;
  let disposed = false;
  let state = createBrowserNavigationState(bridge.snapshot());
  const listeners = new Set<(state: BrowserNavigationState) => void>();
  const addressPopupUnsubscribers = new Set<() => boolean>();
  const unsubscribeBridge = bridge.subscribe((event) => {
    if (disposed) {
      return;
    }
    const nextState = reduceBrowserNavigationState(state, event);
    if (nextState === state) {
      return;
    }
    state = nextState;
    for (const listener of Array.from(listeners)) {
      listener(state);
    }
  });

  if (typeof unsubscribeBridge !== "function") {
    throw createStateError("FENNEVIA_NAVIGATION_STATE_SUBSCRIPTION_INVALID");
  }

  const requireBridge = (): BrowserNavigationBridge => {
    if (disposed || !activeBridge) {
      throw createStateError("FENNEVIA_NAVIGATION_STATE_DISPOSED");
    }
    return activeBridge;
  };

  return Object.freeze({
    back: () => requireBridge().back(),

    dispose(): boolean {
      if (disposed) {
        return false;
      }
      disposed = true;
      activeBridge = null;
      listeners.clear();
      for (const unsubscribe of Array.from(addressPopupUnsubscribers)) {
        unsubscribe();
      }
      addressPopupUnsubscribers.clear();
      unsubscribeBridge();
      return true;
    },

    focusContent: () => requireBridge().focusContent(),
    forward: () => requireBridge().forward(),
    newTab: () => requireBridge().newTab(),
    reload: () => requireBridge().reload(),
    reloadOrStop: () => requireBridge().reloadOrStop(),

    snapshot(): BrowserNavigationState {
      return state;
    },

    status() {
      return Object.freeze({
        disposed,
        addressPopupSubscriberCount: addressPopupUnsubscribers.size,
        revision: state.revision,
        subscriberCount: listeners.size,
      });
    },

    stop: () => requireBridge().stop(),
    submitAddress: (value: string) => requireBridge().submitAddress(value),

    subscribe(
      listener: (state: BrowserNavigationState) => void,
    ): () => boolean {
      requireBridge();
      if (typeof listener !== "function") {
        throw createStateError("FENNEVIA_NAVIGATION_STATE_LISTENER_INVALID");
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

    subscribeAddressPopupOpen(
      listener: (request: AddressPopupOpenRequest) => boolean,
    ): () => boolean {
      if (typeof listener !== "function") {
        throw createStateError(
          "FENNEVIA_NAVIGATION_ADDRESS_POPUP_LISTENER_INVALID",
        );
      }
      const unsubscribeBridgePopup = requireBridge().subscribeAddressPopupOpen(
        (request) => {
          if (
            request?.type !== "address-popup-open" ||
            request.source !== "ctrl-l" ||
            request.selectAll !== true
          ) {
            throw createStateError(
              "FENNEVIA_NAVIGATION_ADDRESS_POPUP_REQUEST_INVALID",
            );
          }
          return listener(
            Object.freeze({
              selectAll: request.selectAll,
              source: request.source,
              type: "address-popup-open" as const,
            }),
          );
        },
      );
      if (typeof unsubscribeBridgePopup !== "function") {
        throw createStateError(
          "FENNEVIA_NAVIGATION_ADDRESS_POPUP_SUBSCRIPTION_INVALID",
        );
      }
      let subscribed = true;
      const unsubscribe = Object.freeze(() => {
        if (!subscribed) {
          return false;
        }
        subscribed = false;
        addressPopupUnsubscribers.delete(unsubscribe);
        unsubscribeBridgePopup();
        return true;
      });
      addressPopupUnsubscribers.add(unsubscribe);
      return unsubscribe;
    },
  });
}
