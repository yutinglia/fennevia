export const toolbarWidgetKinds = Object.freeze([
  "built-in",
  "extension-action",
  "separator",
  "spacer",
  "spring",
] as const);

export type ToolbarWidgetKind = (typeof toolbarWidgetKinds)[number];

const LABEL_MAX_LENGTH = 200;
const TOOLTIP_MAX_LENGTH = 300;
const BADGE_MAX_LENGTH = 8;
const COLOR_MAX_LENGTH = 64;
const ICON_URL_MAX_LENGTH = 512;
const ICON_TOKEN_PATTERN = /^[a-z][a-z0-9-]{0,31}$/u;
const MOZ_EXTENSION_URL_PREFIX = "moz-extension://";

const toolbarWidgetKindSet = new Set<ToolbarWidgetKind>(toolbarWidgetKinds);

export const nonInteractiveToolbarWidgetKinds = Object.freeze([
  "separator",
  "spacer",
  "spring",
] as const);

const nonInteractiveKindSet = new Set<string>(nonInteractiveToolbarWidgetKinds);

export type ToolbarWidgetSnapshot = Readonly<{
  badgeBackground: string;
  badgeText: string;
  badgeTextColor: string;
  disabled: boolean;
  handle: string;
  icon: string;
  iconUrl: string;
  kind: ToolbarWidgetKind;
  label: string;
  tooltip: string;
}>;

export type ToolbarWidgetsSnapshot = Readonly<{
  available: boolean;
  widgets: readonly ToolbarWidgetSnapshot[];
}>;

export type ToolbarWidgetsStateEvent = Readonly<{
  revision: number;
  snapshot: ToolbarWidgetsSnapshot;
  type: "snapshot";
}>;

export type ToolbarWidgetsPopupEvent = Readonly<{
  open: boolean;
  type: "widget-popup";
}>;

export type BrowserToolbarWidgetsBridge = Readonly<{
  invoke: (handle: string, host: unknown) => Promise<boolean>;
  snapshot: () => ToolbarWidgetsSnapshot;
  subscribe: (
    listener: (event: ToolbarWidgetsStateEvent) => void,
  ) => () => boolean;
  subscribePopup: (
    listener: (event: ToolbarWidgetsPopupEvent) => void,
  ) => () => boolean;
}>;

export type BrowserToolbarWidgetsState = Readonly<{
  revision: number;
  snapshot: ToolbarWidgetsSnapshot;
}>;

export type BrowserToolbarWidgetsStateAdapter = Readonly<{
  dispose: () => boolean;
  invoke: (handle: string, host: unknown) => Promise<boolean>;
  snapshot: () => BrowserToolbarWidgetsState;
  status: () => Readonly<{
    disposed: boolean;
    popupSubscriberCount: number;
    revision: number;
    subscriberCount: number;
  }>;
  subscribe: (
    listener: (state: BrowserToolbarWidgetsState) => void,
  ) => () => boolean;
  subscribePopup: (listener: (open: boolean) => void) => () => boolean;
}>;

const createStateError = (code: string): Error => {
  const error = new Error(code);
  error.name = "FenneviaToolbarWidgetsStateError";
  Object.defineProperties(error, {
    fenneviaCode: { enumerable: false, value: code },
    fenneviaPhase: { enumerable: false, value: "toolbar-widgets-state" },
  });
  return error;
};

export function isToolbarWidgetKind(
  candidate: unknown,
): candidate is ToolbarWidgetKind {
  return (
    typeof candidate === "string" &&
    toolbarWidgetKindSet.has(candidate as ToolbarWidgetKind)
  );
}

export function isInteractiveToolbarWidget(
  widget: ToolbarWidgetSnapshot,
): boolean {
  return !nonInteractiveKindSet.has(widget.kind) && widget.handle !== "";
}

const requireBoundedString = (value: unknown, maxLength: number): string => {
  if (typeof value !== "string" || value.length > maxLength) {
    throw createStateError("FENNEVIA_TOOLBAR_WIDGETS_STATE_TEXT_INVALID");
  }
  return value;
};

export function copyToolbarWidgetSnapshot(
  candidate: ToolbarWidgetSnapshot,
): ToolbarWidgetSnapshot {
  if (
    !candidate ||
    typeof candidate !== "object" ||
    !isToolbarWidgetKind(candidate.kind) ||
    typeof candidate.disabled !== "boolean" ||
    typeof candidate.handle !== "string"
  ) {
    throw createStateError("FENNEVIA_TOOLBAR_WIDGETS_STATE_WIDGET_INVALID");
  }
  const nonInteractive = nonInteractiveKindSet.has(candidate.kind);
  if (nonInteractive ? candidate.handle !== "" : candidate.handle === "") {
    throw createStateError("FENNEVIA_TOOLBAR_WIDGETS_STATE_HANDLE_INVALID");
  }
  const icon = requireBoundedString(candidate.icon, 32);
  if (icon !== "" && !ICON_TOKEN_PATTERN.test(icon)) {
    throw createStateError("FENNEVIA_TOOLBAR_WIDGETS_STATE_ICON_INVALID");
  }
  const iconUrl = requireBoundedString(candidate.iconUrl, ICON_URL_MAX_LENGTH);
  if (iconUrl !== "" && !iconUrl.startsWith(MOZ_EXTENSION_URL_PREFIX)) {
    throw createStateError("FENNEVIA_TOOLBAR_WIDGETS_STATE_ICON_URL_INVALID");
  }
  return Object.freeze({
    badgeBackground: requireBoundedString(
      candidate.badgeBackground,
      COLOR_MAX_LENGTH,
    ),
    badgeText: requireBoundedString(candidate.badgeText, BADGE_MAX_LENGTH),
    badgeTextColor: requireBoundedString(
      candidate.badgeTextColor,
      COLOR_MAX_LENGTH,
    ),
    disabled: candidate.disabled,
    handle: candidate.handle,
    icon,
    iconUrl,
    kind: candidate.kind,
    label: requireBoundedString(candidate.label, LABEL_MAX_LENGTH),
    tooltip: requireBoundedString(candidate.tooltip, TOOLTIP_MAX_LENGTH),
  });
}

export function copyToolbarWidgetsSnapshot(
  candidate: ToolbarWidgetsSnapshot,
): ToolbarWidgetsSnapshot {
  if (
    !candidate ||
    typeof candidate !== "object" ||
    typeof candidate.available !== "boolean" ||
    !Array.isArray(candidate.widgets)
  ) {
    throw createStateError("FENNEVIA_TOOLBAR_WIDGETS_STATE_SNAPSHOT_INVALID");
  }
  return Object.freeze({
    available: candidate.available,
    widgets: Object.freeze(candidate.widgets.map(copyToolbarWidgetSnapshot)),
  });
}

export function createBrowserToolbarWidgetsState(
  snapshot: ToolbarWidgetsSnapshot,
  revision = 0,
): BrowserToolbarWidgetsState {
  if (!Number.isSafeInteger(revision) || revision < 0) {
    throw createStateError("FENNEVIA_TOOLBAR_WIDGETS_STATE_REVISION_INVALID");
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
    throw createStateError("FENNEVIA_TOOLBAR_WIDGETS_STATE_EVENT_INVALID");
  }
  if (event.revision <= state.revision) {
    return state;
  }
  return createBrowserToolbarWidgetsState(event.snapshot, event.revision);
}

export function createBrowserToolbarWidgetsStateAdapter(
  bridge: BrowserToolbarWidgetsBridge,
): BrowserToolbarWidgetsStateAdapter {
  if (
    !bridge ||
    typeof bridge !== "object" ||
    typeof bridge.invoke !== "function" ||
    typeof bridge.snapshot !== "function" ||
    typeof bridge.subscribe !== "function" ||
    typeof bridge.subscribePopup !== "function"
  ) {
    throw createStateError("FENNEVIA_TOOLBAR_WIDGETS_STATE_BRIDGE_INVALID");
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
    throw createStateError(
      "FENNEVIA_TOOLBAR_WIDGETS_STATE_SUBSCRIPTION_INVALID",
    );
  }

  const unsubscribePopupBridge = bridge.subscribePopup((event) => {
    if (disposed) {
      return;
    }
    if (event?.type !== "widget-popup" || typeof event.open !== "boolean") {
      throw createStateError("FENNEVIA_TOOLBAR_WIDGETS_STATE_EVENT_INVALID");
    }
    for (const listener of Array.from(popupListeners)) {
      listener(event.open);
    }
  });
  if (typeof unsubscribePopupBridge !== "function") {
    throw createStateError(
      "FENNEVIA_TOOLBAR_WIDGETS_STATE_SUBSCRIPTION_INVALID",
    );
  }

  const requireBridge = (): BrowserToolbarWidgetsBridge => {
    if (disposed || !activeBridge) {
      throw createStateError("FENNEVIA_TOOLBAR_WIDGETS_STATE_DISPOSED");
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

    async invoke(handle: string, host: unknown): Promise<boolean> {
      if (typeof handle !== "string" || handle === "") {
        throw createStateError("FENNEVIA_TOOLBAR_WIDGETS_STATE_HANDLE_INVALID");
      }
      if (host === undefined || host === null || typeof host !== "object") {
        throw createStateError("FENNEVIA_TOOLBAR_WIDGETS_STATE_HOST_INVALID");
      }
      const result = await requireBridge().invoke(handle, host);
      if (typeof result !== "boolean") {
        throw createStateError("FENNEVIA_TOOLBAR_WIDGETS_STATE_RESULT_INVALID");
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
        throw createStateError(
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
        throw createStateError(
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
