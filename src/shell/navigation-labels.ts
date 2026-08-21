import { translate, type MessageKey } from "../app/i18n.ts";
import type { FenneviaLocale } from "../app/locale-state.ts";
import type {
  ConnectionSecurityState,
  TrackingProtectionState,
} from "../app/navigation-state.ts";

export type NavigationStatusPresentation = Readonly<{
  badge: string;
  label: string;
  tone: "danger" | "neutral" | "positive" | "warning";
}>;

export type FirefoxTrustIconState =
  "active" | "disabled" | "insecure" | "warning";

export type FirefoxTrustPresentation = Readonly<{
  connectionLabel: string;
  iconState: FirefoxTrustIconState;
  label: string;
  protectionLabel: string;
  tone: NavigationStatusPresentation["tone"];
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

const trustWarningConnections = new Set<ConnectionSecurityState>([
  "network-error",
  "secure-certificate-override",
]);

const trustInsecureConnections = new Set<ConnectionSecurityState>([
  "associated",
  "certificate-error",
  "https-only-error",
  "not-secure",
]);

const tonePriorities: Readonly<
  Record<NavigationStatusPresentation["tone"], number>
> = Object.freeze({
  danger: 3,
  neutral: 0,
  positive: 1,
  warning: 2,
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

export const resolveFirefoxTrustIconState = (
  connection: ConnectionSecurityState,
  protection: TrackingProtectionState,
): FirefoxTrustIconState => {
  if (trustWarningConnections.has(connection)) {
    return "warning";
  }
  if (trustInsecureConnections.has(connection)) {
    return "insecure";
  }
  if (connection === "unavailable" || protection === "exception") {
    return "disabled";
  }
  return "active";
};

export const getFirefoxTrustPresentation = (
  connectionState: ConnectionSecurityState,
  protectionState: TrackingProtectionState,
  locale: FenneviaLocale,
): FirefoxTrustPresentation => {
  const connection = getConnectionSecurityPresentation(connectionState, locale);
  const protection = getTrackingProtectionPresentation(protectionState, locale);
  const tone =
    tonePriorities[connection.tone] >= tonePriorities[protection.tone]
      ? connection.tone
      : protection.tone;
  return Object.freeze({
    connectionLabel: connection.label,
    iconState: resolveFirefoxTrustIconState(connectionState, protectionState),
    label: translate(locale, "trust.summary", {
      connection: connection.label,
      protection: protection.label,
    }),
    protectionLabel: protection.label,
    tone,
  });
};
