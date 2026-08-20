import type { FenneviaLocale } from "../app/locale-state";
import { translate, type MessageKey } from "../app/i18n";
import type {
  BlockedPermissionIndicatorKind,
  SharingIndicatorKind,
  SitePermissionIndicatorsSnapshot,
  UrlbarItemKind,
} from "../app/urlbar-coverage-state";
import type { NavigationStatusPresentation } from "./navigation-labels";

export const getBlockedPermissionIndicatorLabel = (
  kind: BlockedPermissionIndicatorKind,
  locale: FenneviaLocale,
): string => translate(locale, `permission.blocked.${kind}` as MessageKey);

export const getSharingIndicatorLabel = (
  kind: SharingIndicatorKind,
  locale: FenneviaLocale,
): string => translate(locale, `permission.sharing.${kind}` as MessageKey);

export const getUrlbarItemLabel = (
  kind: UrlbarItemKind,
  locale: FenneviaLocale,
): string => translate(locale, `urlbar.${kind}` as MessageKey);

export const getUrlbarItemTone = (
  kind: UrlbarItemKind,
): NavigationStatusPresentation["tone"] =>
  kind === "remote-control" ? "warning" : "neutral";

export function getSitePermissionPresentation(
  snapshot: SitePermissionIndicatorsSnapshot,
  locale: FenneviaLocale,
): NavigationStatusPresentation {
  if (!snapshot.available) {
    return Object.freeze({
      badge: translate(locale, "permission.site.badgeUnavailable"),
      label: translate(locale, "permission.site.labelUnavailable"),
      tone: "neutral",
    });
  }
  if (snapshot.sharing.length > 0) {
    return Object.freeze({
      badge: translate(locale, "permission.site.badgeActive"),
      label: translate(locale, "permission.site.labelActive"),
      tone: "warning",
    });
  }
  if (snapshot.hasPermissions) {
    return Object.freeze({
      badge: translate(locale, "permission.site.badgeIdle"),
      label: translate(
        locale,
        snapshot.blocked.length > 0
          ? "permission.site.labelBlocked"
          : "permission.site.labelGranted",
      ),
      tone: "neutral",
    });
  }
  return Object.freeze({
    badge: translate(locale, "permission.site.badgeIdle"),
    label: translate(locale, "permission.site.labelNone"),
    tone: "neutral",
  });
}
