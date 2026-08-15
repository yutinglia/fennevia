import type {
  ConnectionSecurityState,
  TrackingProtectionState,
} from "../app/navigation-state";

export type NavigationStatusPresentation = Readonly<{
  badge: string;
  label: string;
  tone: "danger" | "neutral" | "positive" | "warning";
}>;

const connectionPresentations: Readonly<
  Record<ConnectionSecurityState, NavigationStatusPresentation>
> = Object.freeze({
  associated: Object.freeze({
    badge: "Linked",
    label: "Security belongs to an associated page",
    tone: "neutral",
  }),
  "certificate-error": Object.freeze({
    badge: "Cert",
    label: "Certificate error",
    tone: "danger",
  }),
  extension: Object.freeze({
    badge: "Extension",
    label: "Extension page",
    tone: "neutral",
  }),
  "https-only-error": Object.freeze({
    badge: "HTTPS",
    label: "HTTPS-Only Mode could not establish a secure connection",
    tone: "danger",
  }),
  internal: Object.freeze({
    badge: "Firefox",
    label: "Secure Firefox page",
    tone: "neutral",
  }),
  local: Object.freeze({
    badge: "Local",
    label: "Local or potentially trustworthy resource",
    tone: "neutral",
  }),
  "network-error": Object.freeze({
    badge: "Error",
    label: "Network error page",
    tone: "warning",
  }),
  "not-secure": Object.freeze({
    badge: "HTTP",
    label: "Connection is not secure",
    tone: "warning",
  }),
  secure: Object.freeze({
    badge: "HTTPS",
    label: "Secure connection",
    tone: "positive",
  }),
  "secure-certificate-override": Object.freeze({
    badge: "HTTPS",
    label: "Secure connection using a certificate exception",
    tone: "warning",
  }),
  "secure-qualified-certificate": Object.freeze({
    badge: "HTTPS",
    label: "Secure connection with a qualified website certificate",
    tone: "positive",
  }),
  "secure-verified-organization": Object.freeze({
    badge: "HTTPS",
    label: "Secure connection with verified organization information",
    tone: "positive",
  }),
  unavailable: Object.freeze({
    badge: "Info",
    label: "Connection information is unavailable",
    tone: "neutral",
  }),
});

const protectionPresentations: Readonly<
  Record<TrackingProtectionState, NavigationStatusPresentation>
> = Object.freeze({
  blocking: Object.freeze({
    badge: "ETP",
    label: "Enhanced Tracking Protection is blocking known trackers",
    tone: "positive",
  }),
  detected: Object.freeze({
    badge: "ETP",
    label: "Trackers were detected but none are currently blocked",
    tone: "warning",
  }),
  exception: Object.freeze({
    badge: "ETP off",
    label: "Enhanced Tracking Protection is disabled for this site",
    tone: "warning",
  }),
  "no-trackers-detected": Object.freeze({
    badge: "ETP",
    label: "No known trackers detected",
    tone: "neutral",
  }),
  unavailable: Object.freeze({
    badge: "ETP —",
    label: "Enhanced Tracking Protection is not available for this page",
    tone: "neutral",
  }),
});

export const getConnectionSecurityPresentation = (
  state: ConnectionSecurityState,
): NavigationStatusPresentation => connectionPresentations[state];

export const getTrackingProtectionPresentation = (
  state: TrackingProtectionState,
): NavigationStatusPresentation => protectionPresentations[state];
