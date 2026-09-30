// SPDX-License-Identifier: MPL-2.0
export type SettingsTransferRequest =
  | Readonly<{ type: "export" | "prepare-import"; title: string }>
  | Readonly<{ type: "apply-import"; token: string }>
  | Readonly<{ type: "cancel" }>;

export const settingsTransferStatuses = [
  "exported",
  "imported",
  "cancelled",
  "invalid",
  "unsupported",
  "too-large",
  "unavailable",
  "busy",
  "changed",
  "failed",
] as const;
export type SettingsTransferStatus = (typeof settingsTransferStatuses)[number];
export type SettingsTransferResult =
  | Readonly<{ status: SettingsTransferStatus }>
  | Readonly<{
      status: "ready";
      token: string;
      widgetCount: number;
      missingCount: number;
    }>;

const tokenPattern = /^settings-import-[0-9a-f-]{36}$/u;
const invalid = (): never => {
  throw new Error("FENNEVIA_SETTINGS_TRANSFER_CONTRACT_INVALID");
};

export function copySettingsTransferRequest(
  value: unknown,
): SettingsTransferRequest {
  if (!value || typeof value !== "object") return invalid();
  const request = value as Record<string, unknown>;
  if (request.type === "cancel") return Object.freeze({ type: "cancel" });
  if (
    request.type === "apply-import" &&
    typeof request.token === "string" &&
    tokenPattern.test(request.token)
  ) {
    return Object.freeze({ type: request.type, token: request.token });
  }
  if (
    (request.type === "export" || request.type === "prepare-import") &&
    typeof request.title === "string" &&
    request.title.length > 0 &&
    request.title.length <= 120 &&
    !request.title.includes("\0")
  ) {
    return Object.freeze({ type: request.type, title: request.title });
  }
  return invalid();
}

export function copySettingsTransferResult(
  value: unknown,
): SettingsTransferResult {
  if (!value || typeof value !== "object") return invalid();
  const result = value as Record<string, unknown>;
  if (
    settingsTransferStatuses.includes(result.status as SettingsTransferStatus)
  ) {
    return Object.freeze({ status: result.status as SettingsTransferStatus });
  }
  if (
    result.status === "ready" &&
    typeof result.token === "string" &&
    tokenPattern.test(result.token) &&
    Number.isInteger(result.widgetCount) &&
    (result.widgetCount as number) >= 1 &&
    (result.widgetCount as number) <= 128 &&
    Number.isInteger(result.missingCount) &&
    (result.missingCount as number) >= 0 &&
    (result.missingCount as number) <= (result.widgetCount as number)
  ) {
    return Object.freeze({
      status: "ready",
      token: result.token,
      widgetCount: result.widgetCount as number,
      missingCount: result.missingCount as number,
    });
  }
  return invalid();
}
