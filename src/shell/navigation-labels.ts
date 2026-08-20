import type { FenneviaLocale } from "../app/locale-state";
import { translate, type MessageKey } from "../app/i18n";
import type {
  ConnectionSecurityState,
  TrackingProtectionState,
} from "../app/navigation-state";

export type NavigationStatusPresentation = Readonly<{
  badge: string;
  label: string;
  tone: "danger" | "neutral" | "positive" | "warning";
}>;

const connectionTones: Readonly<
  Record<ConnectionSecurityState, NavigationStatusPresentation["tone"]>
> = Object.freeze({
  associated: "neutral",
  "certificate-error": "danger",
  extension: "neutral",
  "https-only-error": "danger",
  internal: "neutral",
  local: "neutral",
  "network-error": "warning",
  "not-secure": "warning",
  secure: "positive",
  "secure-certificate-override": "warning",
  "secure-qualified-certificate": "positive",
  "secure-verified-organization": "positive",
  unavailable: "neutral",
});

const protectionTones: Readonly<
  Record<TrackingProtectionState, NavigationStatusPresentation["tone"]>
> = Object.freeze({
  blocking: "positive",
  detected: "warning",
  exception: "warning",
  "no-trackers-detected": "neutral",
  unavailable: "neutral",
});

export const getConnectionSecurityPresentation = (
  state: ConnectionSecurityState,
  locale: FenneviaLocale,
): NavigationStatusPresentation =>
  Object.freeze({
    badge: translate(locale, `connection.${state}.badge` as MessageKey),
    label: translate(locale, `connection.${state}.label` as MessageKey),
    tone: connectionTones[state],
  });

export const getTrackingProtectionPresentation = (
  state: TrackingProtectionState,
  locale: FenneviaLocale,
): NavigationStatusPresentation =>
  Object.freeze({
    badge: translate(locale, `protection.${state}.badge` as MessageKey),
    label: translate(locale, `protection.${state}.label` as MessageKey),
    tone: protectionTones[state],
  });
