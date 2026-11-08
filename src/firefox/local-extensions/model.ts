// SPDX-License-Identifier: MPL-2.0
import {
  localExtensionResults,
  type LocalExtensionResult,
} from "../../app/local-extensions.ts";
export const limits = Object.freeze({
  entries: 24,
  registry: 524288,
  manifest: 262144,
  files: 4096,
  depth: 16,
  file: 16777216,
  archive: 67108864,
  total: 134217728,
  permissions: 256,
});
export const enabledPref = "fennevia.localExtensions.enabled";
export const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u;
export type Payload = Readonly<{
  key: string;
  generation: string;
  kind: "folder" | "xpi" | "zip";
  digest: string;
}>;
export type Metadata = Readonly<{
  id: string;
  name: string;
  version: string;
  required: readonly string[];
  optional: readonly string[];
}>;
export type Entry = Metadata &
  Readonly<{
    payload: Payload;
    pending?: Payload;
    enabled: boolean;
    interrupted: boolean;
  }>;
export type Registry = Readonly<{
  version: 1;
  revision: number;
  entries: readonly Entry[];
}>;
export class LocalExtensionError extends Error {
  readonly code: Exclude<LocalExtensionResult["status"], "preview">;
  readonly symbol?: string;
  constructor(
    code: Exclude<LocalExtensionResult["status"], "preview">,
    symbol?: string,
  ) {
    super(
      "FENNEVIA_LOCAL_EXTENSION_" + code.replaceAll("-", "_").toUpperCase(),
    );
    this.code = code;
    this.symbol = symbol;
  }
}
export function failure(error: unknown): LocalExtensionResult {
  return {
    status:
      error instanceof LocalExtensionError &&
      localExtensionResults.includes(error.code)
        ? error.code
        : "failed",
  };
}
const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
export function cleanText(value: unknown, size: number): string {
  if (
    typeof value !== "string" ||
    !value ||
    value.length > size ||
    /[\p{Cc}\u202a-\u202e\u2066-\u2069]/u.test(value)
  )
    throw new LocalExtensionError("invalid");
  return value;
}
export function permissionList(value: unknown): readonly string[] {
  if (!Array.isArray(value) || value.length > limits.permissions)
    throw new LocalExtensionError("too-large");
  return Object.freeze(
    [...new Set(value.map((item) => cleanText(item, 512)))].sort(),
  );
}
export function parseMetadata(value: unknown): Metadata {
  if (!record(value)) throw new LocalExtensionError("invalid");
  const id = cleanText(value.id, 255);
  if (!/^(?:\{[0-9a-f-]{36}\}|[^\s@]+@[^\s@]+)$/iu.test(id))
    throw new LocalExtensionError("missing-id");
  return {
    id,
    name: cleanText(value.name, 160),
    version: cleanText(value.version, 64),
    required: permissionList(value.required),
    optional: permissionList(value.optional),
  };
}
export function parsePayload(value: unknown): Payload {
  if (
    !record(value) ||
    typeof value.key !== "string" ||
    !uuidPattern.test(value.key) ||
    typeof value.generation !== "string" ||
    !uuidPattern.test(value.generation) ||
    !["folder", "xpi", "zip"].includes(String(value.kind)) ||
    typeof value.digest !== "string" ||
    !/^[a-f0-9]{64}$/u.test(value.digest)
  )
    throw new LocalExtensionError("corrupt");
  return {
    key: value.key,
    generation: value.generation,
    kind: value.kind as Payload["kind"],
    digest: value.digest,
  };
}
export function parseRegistry(text: string | null): Registry {
  if (text === null) return { version: 1, revision: 0, entries: [] };
  if (text.length > limits.registry) throw new LocalExtensionError("corrupt");
  try {
    const data: unknown = JSON.parse(text);
    if (
      !record(data) ||
      data.version !== 1 ||
      !Number.isSafeInteger(data.revision) ||
      (data.revision as number) < 0 ||
      !Array.isArray(data.entries) ||
      data.entries.length > limits.entries
    )
      throw new LocalExtensionError("corrupt");
    const ids = new Set<string>();
    const keys = new Set<string>();
    const entries = data.entries.map((value) => {
      if (
        !record(value) ||
        typeof value.enabled !== "boolean" ||
        typeof value.interrupted !== "boolean"
      )
        throw new LocalExtensionError("corrupt");
      const metadata = parseMetadata(value);
      const payload = parsePayload(value.payload);
      const pending =
        value.pending === undefined ? undefined : parsePayload(value.pending);
      if (
        pending &&
        (pending.key !== payload.key ||
          pending.generation === payload.generation ||
          !value.interrupted)
      )
        throw new LocalExtensionError("corrupt");
      if (ids.has(metadata.id) || keys.has(payload.key))
        throw new LocalExtensionError("corrupt");
      ids.add(metadata.id);
      keys.add(payload.key);
      return {
        ...metadata,
        payload,
        ...(pending ? { pending } : {}),
        enabled: value.enabled,
        interrupted: value.interrupted,
      };
    });
    return { version: 1, revision: data.revision as number, entries };
  } catch {
    throw new LocalExtensionError("corrupt");
  }
}
export function archiveName(value: unknown): string {
  const name = cleanText(value, 1024);
  const segments = name.replace(/\/$/u, "").split("/");
  if (
    segments.length > limits.depth ||
    segments.some(
      (part) =>
        !part ||
        part === "." ||
        part === ".." ||
        /[\\:\p{Cc}]/u.test(part) ||
        /[. ]$/u.test(part),
    )
  )
    throw new LocalExtensionError("invalid");
  return name;
}
export function sameMetadata(a: Metadata, b: Metadata): boolean {
  return (
    a.id === b.id &&
    a.name === b.name &&
    a.version === b.version &&
    JSON.stringify(a.required) === JSON.stringify(b.required) &&
    JSON.stringify(a.optional) === JSON.stringify(b.optional)
  );
}
