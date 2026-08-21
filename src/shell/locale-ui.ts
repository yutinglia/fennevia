import { translate, type MessageKey } from "../app/i18n";
import { en } from "../app/messages/en";
import type { FenneviaLocale } from "../app/locale-state";
import type { TabStripLabels } from "../app/tab-strip";
import type { ToolbarZoneName } from "../app/toolbar-widgets-state";

const ownedEnglishLabels = Object.freeze({
  [en["widget.fenneviaControl"]]: "widget.fenneviaControl",
  [en["widget.flexibleSpace"]]: "widget.flexibleSpace",
  [en["widget.separator"]]: "widget.separator",
  [en["widget.showBookmarks"]]: "widget.showBookmarks",
  [en["widget.showBookmarksTooltip"]]: "widget.showBookmarksTooltip",
  [en["widget.showDownloads"]]: "widget.showDownloads",
  [en["widget.showDownloadsTooltip"]]: "widget.showDownloadsTooltip",
  [en["widget.showTranslate"]]: "widget.showTranslate",
  [en["widget.showTranslateTooltip"]]: "widget.showTranslateTooltip",
  [en["widget.space"]]: "widget.space",
  [en["widget.toolbarItem"]]: "widget.toolbarItem",
} as const);

export function createTabStripLabels(locale: FenneviaLocale): TabStripLabels {
  return Object.freeze({
    allowMedia: translate(locale, "tab.allowMedia"),
    attention: translate(locale, "tab.attention"),
    cameraInUse: translate(locale, "tab.cameraInUse"),
    close: translate(locale, "tab.close"),
    crashed: translate(locale, "tab.crashed"),
    indexOf: translate(locale, "tab.indexOf"),
    loading: translate(locale, "tab.loading"),
    mediaBlocked: translate(locale, "tab.mediaBlocked"),
    microphoneInUse: translate(locale, "tab.microphoneInUse"),
    mute: translate(locale, "tab.mute"),
    muted: translate(locale, "tab.muted"),
    pin: translate(locale, "tab.pin"),
    pinned: translate(locale, "tab.pinned"),
    pip: translate(locale, "tab.pip"),
    playing: translate(locale, "tab.playing"),
    screenSharing: translate(locale, "tab.screenSharing"),
    unmute: translate(locale, "tab.unmute"),
    unpin: translate(locale, "tab.unpin"),
    untitled: translate(locale, "tab.untitled"),
  });
}

export function localizeOwnedText(
  locale: FenneviaLocale,
  value: string,
): string {
  const key = ownedEnglishLabels[value as keyof typeof ownedEnglishLabels];
  return key ? translate(locale, key) : value;
}

export function localizeWidgetLabel(
  locale: FenneviaLocale,
  widget: Readonly<{
    fenneviaAction?: string;
    kind: string;
    label: string;
    missing?: boolean;
  }>,
): string {
  let label = widget.label;
  if (widget.fenneviaAction === "show-bookmarks") {
    label = translate(locale, "widget.showBookmarks");
  } else if (widget.fenneviaAction === "show-downloads") {
    label = translate(locale, "widget.showDownloads");
  } else if (widget.fenneviaAction === "show-translate") {
    label = translate(locale, "widget.showTranslate");
  } else if (widget.kind === "separator") {
    label = translate(locale, "widget.separator");
  } else if (widget.kind === "spacer") {
    label = translate(locale, "widget.space");
  } else if (widget.kind === "spring") {
    label = translate(locale, "widget.flexibleSpace");
  } else if (!label) {
    label = translate(locale, "widget.toolbarItem");
  } else {
    label = localizeOwnedText(locale, label);
  }
  if (widget.missing) {
    return translate(locale, "widget.unavailableSuffix", { label });
  }
  return label;
}

export function localizeWidgetTooltip(
  locale: FenneviaLocale,
  tooltip: string,
  fallback: string,
): string {
  return localizeOwnedText(locale, tooltip) || fallback;
}

export function zoneDisplayName(
  locale: FenneviaLocale,
  zone: ToolbarZoneName,
): string {
  return translate(locale, `customize.zone.${zone}` as MessageKey);
}
