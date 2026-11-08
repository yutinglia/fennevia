// SPDX-License-Identifier: MPL-2.0
export const localExtensionStates = [
  "disabled",
  "waiting",
  "loading",
  "loaded",
  "conflict",
  "corrupt",
  "failed",
  "interrupted",
] as const;
export type LocalExtensionState = (typeof localExtensionStates)[number];
export type LocalExtensionRow = Readonly<{
  token: string;
  name: string;
  version: string;
  enabled: boolean;
  state: LocalExtensionState;
}>;
export type LocalExtensionsSnapshot = Readonly<{
  status: "starting" | "ready" | "unavailable" | "private" | "recovery";
  enabled: boolean;
  busy: boolean;
  rows: readonly LocalExtensionRow[];
}>;
export type LocalExtensionRequest =
  | Readonly<{
      type: "prepare";
      source: "file" | "folder";
      title: string;
      token?: string;
    }>
  | Readonly<{ type: "confirm"; token: string }>
  | Readonly<{
      type: "enable" | "disable" | "reload" | "remove";
      token: string;
    }>
  | Readonly<{
      type: "cancel" | "disable-all" | "open-addons" | "open-debugging";
    }>;
export const localExtensionResults = [
  "done",
  "cancelled",
  "busy",
  "unavailable",
  "invalid",
  "unsupported-location",
  "too-large",
  "missing-id",
  "incompatible",
  "conflict",
  "changed",
  "corrupt",
  "failed",
  "partial",
  "interrupted",
] as const;
export type LocalExtensionResult =
  | Readonly<{ status: (typeof localExtensionResults)[number] }>
  | Readonly<{
      status: "preview";
      token: string;
      name: string;
      version: string;
      update: boolean;
      required: readonly string[];
      optional: readonly string[];
    }>;
export type LocalExtensionsBridge = Readonly<{
  snapshot: () => LocalExtensionsSnapshot;
  subscribe: (listener: (state: LocalExtensionsSnapshot) => void) => () => void;
  request: (request: LocalExtensionRequest) => Promise<LocalExtensionResult>;
}>;

export function copyLocalExtensionRequest(
  value: LocalExtensionRequest,
): LocalExtensionRequest {
  const invalid = () => {
    throw new Error("FENNEVIA_LOCAL_EXTENSION_REQUEST_INVALID");
  };
  if (!value || typeof value !== "object") return invalid();
  const token = (candidate: unknown): string =>
    typeof candidate === "string" && /^[a-z0-9-]{1,80}$/u.test(candidate)
      ? candidate
      : invalid();
  if (value.type === "prepare") {
    if (
      !["file", "folder"].includes(value.source) ||
      typeof value.title !== "string" ||
      value.title.length > 120 ||
      !value.title.trim()
    )
      return invalid();
    return {
      type: "prepare",
      source: value.source,
      title: value.title,
      ...(value.token === undefined ? {} : { token: token(value.token) }),
    };
  }
  if (["confirm", "enable", "disable", "reload", "remove"].includes(value.type))
    return {
      type: value.type,
      token: token("token" in value ? value.token : null),
    } as LocalExtensionRequest;
  if (
    ["cancel", "disable-all", "open-addons", "open-debugging"].includes(
      value.type,
    )
  )
    return { type: value.type } as LocalExtensionRequest;
  return invalid();
}

// Copy at the ordinary-data boundary: never retain a native wrapper or mutable array.
export function copyLocalExtensionsSnapshot(
  value: LocalExtensionsSnapshot,
): LocalExtensionsSnapshot {
  if (
    !["starting", "ready", "unavailable", "private", "recovery"].includes(
      value.status,
    ) ||
    value.rows.length > 24 ||
    typeof value.busy !== "boolean" ||
    typeof value.enabled !== "boolean"
  )
    throw new Error("FENNEVIA_LOCAL_EXTENSION_SNAPSHOT_INVALID");
  return Object.freeze({
    status: value.status,
    busy: value.busy,
    enabled: value.enabled,
    rows: Object.freeze(
      value.rows.map((row) => {
        if (
          !/^[a-z0-9-]{1,80}$/u.test(row.token) ||
          typeof row.name !== "string" ||
          row.name.length > 160 ||
          typeof row.version !== "string" ||
          row.version.length > 64 ||
          typeof row.enabled !== "boolean" ||
          !localExtensionStates.includes(row.state)
        )
          throw new Error("FENNEVIA_LOCAL_EXTENSION_ROW_INVALID");
        return Object.freeze({
          token: row.token,
          name: row.name,
          version: row.version,
          enabled: row.enabled,
          state: row.state,
        });
      }),
    ),
  });
}
