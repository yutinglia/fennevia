import type {
  BlockedPermissionIndicatorKind,
  SharingIndicatorKind,
  SitePermissionIndicatorsSnapshot,
  UrlbarItemKind,
} from "../app/urlbar-coverage-state";
import type { NavigationStatusPresentation } from "./navigation-labels";

const blockedPermissionLabels: Readonly<
  Record<BlockedPermissionIndicatorKind, string>
> = Object.freeze({
  autoplay: "Autoplay blocked",
  camera: "Camera blocked",
  canvas: "Canvas access blocked",
  install: "Add-on install blocked",
  "local-network": "Local network blocked",
  location: "Location blocked",
  "loopback-network": "Loopback network access blocked",
  microphone: "Microphone blocked",
  midi: "MIDI blocked",
  notifications: "Notifications blocked",
  "persistent-storage": "Persistent storage blocked",
  popups: "Pop-up or redirect blocked",
  screen: "Screen sharing blocked",
  serial: "Serial device blocked",
  xr: "XR access blocked",
});

const sharingLabels: Readonly<Record<SharingIndicatorKind, string>> =
  Object.freeze({
    location: "Location in use",
    media: "Camera, microphone, or screen in use",
    serial: "Serial device in use",
    xr: "XR device in use",
  });

const itemLabels: Readonly<Record<UrlbarItemKind, string>> = Object.freeze({
  bookmark: "Bookmark page",
  container: "Container tab",
  "extension-actions": "Extension page actions",
  "more-page-actions": "More page actions",
  "other-page-actions": "Additional page actions",
  "persisted-search": "Persisted search terms",
  "picture-in-picture": "Picture-in-Picture",
  recommendation: "Firefox recommendation",
  "reader-view": "Reader View",
  "remote-control": "Browser under remote control",
  "search-mode": "Search mode",
  "split-view": "Split view",
  "taskbar-tabs": "Taskbar tab controls",
  translations: "Translate page",
  zoom: "Reset page zoom",
});

export const getBlockedPermissionIndicatorLabel = (
  kind: BlockedPermissionIndicatorKind,
): string => blockedPermissionLabels[kind];

export const getSharingIndicatorLabel = (kind: SharingIndicatorKind): string =>
  sharingLabels[kind];

export const getUrlbarItemLabel = (kind: UrlbarItemKind): string =>
  itemLabels[kind];

export const getUrlbarItemTone = (
  kind: UrlbarItemKind,
): NavigationStatusPresentation["tone"] =>
  kind === "remote-control" ? "warning" : "neutral";

export function getSitePermissionPresentation(
  snapshot: SitePermissionIndicatorsSnapshot,
): NavigationStatusPresentation {
  if (!snapshot.available) {
    return Object.freeze({
      badge: "Permissions —",
      label: "Site permission information is not available for this page",
      tone: "neutral",
    });
  }
  if (snapshot.sharing.length > 0) {
    return Object.freeze({
      badge: "In use",
      label: "Firefox reports an active site capability",
      tone: "warning",
    });
  }
  if (snapshot.hasPermissions) {
    return Object.freeze({
      badge: "Permissions",
      label:
        snapshot.blocked.length > 0
          ? "Firefox is blocking one or more site capabilities"
          : "Firefox has site-specific permissions for this page",
      tone: "neutral",
    });
  }
  return Object.freeze({
    badge: "Permissions",
    label: "No site permission indicator is active",
    tone: "neutral",
  });
}
