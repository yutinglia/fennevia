// SPDX-License-Identifier: MPL-2.0
import {
  archiveName,
  cleanText,
  enabledPref,
  limits,
  LocalExtensionError,
  parseMetadata,
  parsePayload,
  permissionList,
  uuidPattern,
  type Payload,
} from "./model.ts";
import type { LocalExtensionPort, NativeAddon, NativeEvent } from "./ports.ts";

type File = {
  path: string;
  target: string;
  fileSize: number;
  parent: File | null;
  clone(): File;
  append(part: string): void;
  initWithPath(path: string): void;
  normalize(): void;
  isDirectory(): boolean;
  isFile(): boolean;
};
type IO = {
  exists(path: string): Promise<boolean>;
  stat(path: string): Promise<{ type: string; size: number }>;
  readUTF8(path: string): Promise<string>;
  writeUTF8(path: string, text: string, options?: object): Promise<number>;
  copy(source: string, target: string, options: object): Promise<void>;
  makeDirectory(path: string, options?: object): Promise<void>;
  getChildren(path: string): Promise<string[]>;
  remove(path: string, options?: object): Promise<void>;
  computeHexDigest(path: string, method: "sha256"): Promise<string>;
};
type RecordValue = Record<string, unknown>;
type Environment = {
  Cc: Record<string, { createInstance(iid: unknown): unknown }>;
  Ci: Record<string, unknown>;
  IOUtils: IO;
  PathUtils: {
    join(...parts: string[]): string;
    filename(path: string): string;
    parent(path: string): string;
  };
  ChromeUtils: { importESModule(uri: string): RecordValue };
  Services: {
    appinfo: { OS: string; inSafeMode: boolean };
    env: { get(name: string): string };
    prefs: {
      getBoolPref(name: string, fallback: boolean): boolean;
      setBoolPref(name: string, value: boolean): void;
    };
    dirsvc: { get(name: string, iid: unknown): File };
    io: {
      newFileURI(file: File): { spec: string };
      newURI(uri: string): unknown;
    };
    uuid: { generateUUID(): { toString(): string } };
    policies?: { isAllowed(name: string): boolean };
  };
};
type Manager = {
  readyPromise: Promise<void>;
  getAddonByID(id: string): Promise<NativeAddon | null>;
  installTemporaryAddon(file: File): Promise<NativeAddon>;
  addAddonListener(listener: object): void;
  removeAddonListener(listener: object): void;
};
type ExtensionData = {
  id: string | null;
  type: string;
  manifest: RecordValue;
  errors: unknown[];
  loadManifest(): Promise<unknown>;
  getRequiredPermissions(): unknown;
  getRequestedPermissions(): unknown;
  manifestOptionalPermissions: unknown;
};
type ZipReader = {
  open(file: File): void;
  close(): void;
  findEntries(pattern: null): { hasMore(): boolean; getNext(): string };
  getEntry(name: string): { realSize: number; isDirectory: boolean };
  test(name: null): void;
};
type Inventory = { name: string; size: number; digest: string }[];
const asRecord = (value: unknown): RecordValue => {
  if (typeof value !== "object" || value === null)
    throw new LocalExtensionError("unavailable");
  return value as RecordValue;
};
function requireMethods(value: unknown, names: readonly string[]) {
  const record = asRecord(value);
  const missing = names.find((name) => typeof record[name] !== "function");
  if (missing) throw new LocalExtensionError("unavailable", missing);
}

export function createNativeLocalExtensionPort(
  environment: unknown,
): LocalExtensionPort {
  const candidate = asRecord(environment);
  for (const field of [
    "Cc",
    "Ci",
    "IOUtils",
    "PathUtils",
    "ChromeUtils",
    "Services",
  ])
    asRecord(candidate[field]);
  // Capture only process APIs, never the first browser window in this port.
  const { Cc, Ci, IOUtils, PathUtils, ChromeUtils, Services } =
    environment as Environment;
  const env: Environment = {
    Cc,
    Ci,
    IOUtils,
    PathUtils,
    ChromeUtils,
    Services,
  };
  if (env.Services.appinfo.OS !== "WINNT")
    throw new LocalExtensionError("unavailable");
  requireMethods(env.IOUtils, [
    "exists",
    "stat",
    "readUTF8",
    "writeUTF8",
    "copy",
    "makeDirectory",
    "getChildren",
    "remove",
    "computeHexDigest",
  ]);
  requireMethods(env.PathUtils, ["join", "filename", "parent"]);
  requireMethods(env.ChromeUtils, ["importESModule"]);
  const manager = env.ChromeUtils.importESModule(
    "resource://gre/modules/AddonManager.sys.mjs",
  ).AddonManager as Manager;
  requireMethods(manager, [
    "getAddonByID",
    "installTemporaryAddon",
    "addAddonListener",
    "removeAddonListener",
  ]);
  const Extension = env.ChromeUtils.importESModule(
    "resource://gre/modules/Extension.sys.mjs",
  ).ExtensionData as new (uri: unknown) => ExtensionData;
  if (typeof Extension !== "function")
    throw new LocalExtensionError("unavailable", "ExtensionData");
  const io = env.IOUtils;
  const paths = env.PathUtils;
  const services = env.Services;
  const profile = services.dirsvc.get("ProfD", env.Ci.nsIFile).path;
  const root = paths.join(profile, "fennevia", "local-extensions");
  const marker = paths.join(root, "owner.json");
  const registry = paths.join(root, "registry.json");
  const rootOwner = '{"owner":"fennevia-local-extensions","version":1}';
  const systemDrive = services.env.get("SystemDrive").toLowerCase();
  const uuid = () => {
    const id = services.uuid
      .generateUUID()
      .toString()
      .replace(/[{}]/gu, "")
      .toLowerCase();
    if (!uuidPattern.test(id)) throw new LocalExtensionError("unavailable");
    return id;
  };
  const file = (path: string): File => {
    const result = env.Cc["@mozilla.org/file/local;1"].createInstance(
      env.Ci.nsIFile,
    ) as File;
    requireMethods(result, [
      "initWithPath",
      "normalize",
      "isDirectory",
      "isFile",
    ]);
    result.initWithPath(path);
    return result;
  };
  // nsIFile.isSymlink() always returns false on Windows. ResolveAndStat followed
  // through fileSize, then target comparison rejects junctions/symlinks.
  // isDirectory/isFile only read attributes and do NOT populate the resolved path.
  // The first version accepts only the Windows system volume: Firefox exposes no
  // reliable scripted GetDriveType for excluding transient mapped network drives.
  const plainPath = async (path: string, absent = false): Promise<void> => {
    if (
      !/^[a-z]:\\/iu.test(path) ||
      path.slice(0, 2).toLowerCase() !== systemDrive ||
      /[\p{Cc}]/u.test(path) ||
      path
        .slice(3)
        .split("\\")
        .some(
          (part) =>
            !part ||
            part === "." ||
            part === ".." ||
            /[. ]$/u.test(part) ||
            /[:*?"<>|]/u.test(part),
        )
    )
      throw new LocalExtensionError("unsupported-location");
    let current: File | null = file(path);
    while (current) {
      if (await io.exists(current.path)) {
        try {
          if (!Number.isFinite(current.fileSize))
            throw new LocalExtensionError("unsupported-location");
        } catch {
          throw new LocalExtensionError("unsupported-location");
        }
        if (!current.isDirectory() && !current.isFile())
          throw new LocalExtensionError("unsupported-location");
        const normalized = current.clone();
        // Windows nsIFile.parent returns C: for the drive root. Normalizing
        // that drive-relative spelling resolves the process working directory.
        if (!/^[a-z]:\\?$/iu.test(current.path)) normalized.normalize();
        const canonical = (value: string) =>
          /^[a-z]:\\?$/iu.test(value)
            ? value.slice(0, 2).toLowerCase()
            : value.toLowerCase();
        if (
          canonical(current.target) !== canonical(current.path) ||
          canonical(normalized.path) !== canonical(current.path)
        )
          throw new LocalExtensionError("unsupported-location");
      } else if (!absent) throw new LocalExtensionError("corrupt");
      current = current.parent;
    }
  };
  const boundedText = async (path: string, max: number): Promise<string> => {
    await plainPath(path);
    const info = await io.stat(path);
    if (info.type !== "regular" || info.size > max)
      throw new LocalExtensionError("too-large");
    const text = await io.readUTF8(path);
    if (text.length > max) throw new LocalExtensionError("too-large");
    return text;
  };
  const ensureRoot = async (create: boolean): Promise<boolean> => {
    await plainPath(root, true);
    if (!(await io.exists(root))) {
      if (!create) return false;
      await io.makeDirectory(root, { ignoreExisting: false });
      await io.writeUTF8(marker, rootOwner, { mode: "create" });
    }
    if ((await boundedText(marker, 128)) !== rootOwner)
      throw new LocalExtensionError("corrupt");
    return true;
  };
  const generationRoot = (payload: Payload) =>
    paths.join(root, payload.key, payload.generation);
  const payloadPath = (payload: Payload) =>
    paths.join(
      generationRoot(payload),
      payload.kind === "folder" ? "content" : `content.${payload.kind}`,
    );
  const inventory = async (path: string): Promise<Inventory> => {
    const result: Inventory = [];
    let bytes = 0;
    let nodes = 0;
    const walk = async (
      target: string,
      relative: string,
      depth: number,
    ): Promise<void> => {
      if (++nodes > limits.files || depth > limits.depth)
        throw new LocalExtensionError("too-large");
      await plainPath(target);
      const info = await io.stat(target);
      if (info.type === "directory") {
        result.push({ name: relative + "/", size: 0, digest: "" });
        const children = await io.getChildren(target);
        if (children.length > limits.files)
          throw new LocalExtensionError("too-large");
        for (const child of children.sort()) {
          const name = paths.filename(child);
          archiveName(name);
          if (child !== paths.join(target, name))
            throw new LocalExtensionError("invalid");
          await walk(child, relative ? relative + "/" + name : name, depth + 1);
        }
      } else if (info.type === "regular") {
        bytes += info.size;
        const max = relative === "" ? limits.archive : limits.file;
        if (info.size < 0 || info.size > max || bytes > limits.total)
          throw new LocalExtensionError("too-large");
        result.push({
          name: relative,
          size: info.size,
          digest: await io.computeHexDigest(target, "sha256"),
        });
      } else throw new LocalExtensionError("unsupported-location");
    };
    await walk(path, "", 0);
    return result;
  };
  const checkArchive = async (path: string): Promise<void> => {
    const reader = env.Cc["@mozilla.org/libjar/zip-reader;1"].createInstance(
      env.Ci.nsIZipReader,
    ) as ZipReader;
    requireMethods(reader, [
      "open",
      "close",
      "findEntries",
      "getEntry",
      "test",
    ]);
    reader.open(file(path));
    try {
      const names = new Set<string>();
      const entries = reader.findEntries(null);
      let count = 0;
      let total = 0;
      let manifest = false;
      while (entries.hasMore()) {
        if (++count > limits.files) throw new LocalExtensionError("too-large");
        const name = archiveName(entries.getNext());
        const key = name.replace(/\/$/u, "").toLowerCase();
        if (names.has(key)) throw new LocalExtensionError("invalid");
        names.add(key);
        const entry = reader.getEntry(name);
        total += entry.realSize;
        if (
          entry.realSize < 0 ||
          entry.realSize > limits.file ||
          total > limits.total
        )
          throw new LocalExtensionError("too-large");
        if (name === "manifest.json") {
          manifest = true;
          if (entry.realSize > limits.manifest)
            throw new LocalExtensionError("too-large");
        }
      }
      if (!manifest) throw new LocalExtensionError("invalid");
      reader.test(null);
    } finally {
      reader.close();
    }
  };
  const seal = async (payload: Payload, files: Inventory): Promise<string> => {
    const path = paths.join(generationRoot(payload), "owner.json");
    await io.writeUTF8(
      path,
      JSON.stringify({
        owner: "fennevia",
        key: payload.key,
        generation: payload.generation,
        kind: payload.kind,
        files,
      }),
      { mode: "create" },
    );
    return io.computeHexDigest(path, "sha256");
  };
  const verify = async (input: Payload): Promise<void> => {
    const payload = parsePayload(input);
    await ensureRoot(false);
    const base = generationRoot(payload);
    await plainPath(base);
    const ownerPath = paths.join(base, "owner.json");
    const owner = JSON.parse(
      await boundedText(ownerPath, limits.registry),
    ) as RecordValue;
    if (
      owner.owner !== "fennevia" ||
      owner.key !== payload.key ||
      owner.generation !== payload.generation ||
      owner.kind !== payload.kind ||
      (await io.computeHexDigest(ownerPath, "sha256")) !== payload.digest
    )
      throw new LocalExtensionError("corrupt");
    const expected = [ownerPath, payloadPath(payload)].sort();
    if (
      JSON.stringify((await io.getChildren(base)).sort()) !==
        JSON.stringify(expected) ||
      JSON.stringify(await inventory(payloadPath(payload))) !==
        JSON.stringify(owner.files)
    )
      throw new LocalExtensionError("corrupt");
  };
  const uri = (payload: Payload) =>
    services.io.newFileURI(file(payloadPath(payload))).spec;
  const normalizePermissions = (input: unknown): readonly string[] => {
    const data = asRecord(input);
    const values: string[] = [];
    for (const [key, prefix] of [
      ["permissions", "permission"],
      ["origins", "site"],
      ["data_collection", "data"],
    ]) {
      const items = data[key] ?? [];
      for (const item of permissionList(items))
        values.push(prefix + ":" + item);
    }
    return permissionList(values);
  };
  return {
    uuid,
    verify,
    uri,
    ready: async () => {
      await manager.readyPromise;
    },
    allowed: () =>
      !services.appinfo.inSafeMode &&
      !services.prefs.getBoolPref("fennevia.safeStart", false) &&
      services.prefs.getBoolPref("xpinstall.enabled", true) &&
      (services.policies?.isAllowed("xpinstall") ?? true),
    enabled: () => services.prefs.getBoolPref(enabledPref, false),
    setEnabled: (value) => services.prefs.setBoolPref(enabledPref, value),
    async read() {
      if (!(await ensureRoot(false)) || !(await io.exists(registry)))
        return null;
      return boundedText(registry, limits.registry);
    },
    async write(next, expected) {
      if (next.length > limits.registry)
        throw new LocalExtensionError("too-large");
      await ensureRoot(true);
      const current = (await io.exists(registry))
        ? await boundedText(registry, limits.registry)
        : null;
      if (current !== expected) throw new LocalExtensionError("changed");
      const temporary = paths.join(root, uuid() + ".tmp");
      await plainPath(temporary, true);
      try {
        await io.writeUTF8(registry, next, { tmpPath: temporary, flush: true });
      } finally {
        if (await io.exists(temporary)) {
          await plainPath(temporary);
          await io.remove(temporary);
        }
      }
    },
    async choose(window, source, title, signal) {
      const view = asRecord(window);
      const constants = asRecord(env.Ci.nsIFilePicker);
      const picker = env.Cc["@mozilla.org/filepicker;1"].createInstance(
        env.Ci.nsIFilePicker,
      ) as {
        init(context: unknown, title: string, mode: unknown): void;
        appendFilter(label: string, pattern: string): void;
        open(callback: (value: unknown) => void): void;
        file: File | null;
      };
      requireMethods(picker, ["init", "appendFilter", "open"]);
      picker.init(
        view.browsingContext,
        cleanText(title, 120),
        source === "folder" ? constants.modeGetFolder : constants.modeOpen,
      );
      if (source === "file")
        picker.appendFilter("Firefox extensions", "*.xpi;*.zip");
      return new Promise((resolve, reject) => {
        let done = false;
        const finish = (value: string | null) => {
          if (done) return;
          done = true;
          signal.removeEventListener("abort", cancel);
          resolve(value);
        };
        const cancel = () => finish(null);
        signal.addEventListener("abort", cancel, { once: true });
        if (signal.aborted) {
          cancel();
          return;
        }
        try {
          picker.open((value) => {
            if (done) return;
            try {
              finish(
                value === constants.returnOK
                  ? (picker.file?.path ?? null)
                  : null,
              );
            } catch (error) {
              done = true;
              signal.removeEventListener("abort", cancel);
              reject(error);
            }
          });
        } catch (error) {
          done = true;
          signal.removeEventListener("abort", cancel);
          reject(error);
        }
      });
    },
    async stage(source, kind, key) {
      await plainPath(source);
      await ensureRoot(true);
      const extension = source.split(".").at(-1)?.toLowerCase();
      if (kind === "file" && extension !== "xpi" && extension !== "zip")
        throw new LocalExtensionError("invalid");
      const payload: Payload = {
        key: key ?? uuid(),
        generation: uuid(),
        kind: kind === "folder" ? "folder" : (extension as "xpi" | "zip"),
        digest: "0".repeat(64),
      };
      parsePayload(payload);
      const original = await inventory(source);
      if (kind === "folder") {
        const manifest = original.find((item) => item.name === "manifest.json");
        if (!manifest || manifest.size > limits.manifest)
          throw new LocalExtensionError("invalid");
      } else await checkArchive(source);
      const base = generationRoot(payload);
      await plainPath(base, true);
      await io.makeDirectory(base, { ignoreExisting: false });
      const target = payloadPath(payload);
      try {
        for (const item of original) {
          const relative = item.name.replace(/\/$/u, "");
          const destination = relative
            ? paths.join(target, ...relative.split("/"))
            : target;
          await plainPath(destination, true);
          if (item.name.endsWith("/"))
            await io.makeDirectory(destination, { ignoreExisting: false });
          else {
            const from = relative
              ? paths.join(source, ...relative.split("/"))
              : source;
            await plainPath(from);
            await io.copy(from, destination, { noOverwrite: true });
          }
        }
        const copied = await inventory(target);
        if (JSON.stringify(copied) !== JSON.stringify(original))
          throw new LocalExtensionError("changed");
        return { ...payload, digest: await seal(payload, copied) };
      } catch (error) {
        // Only our exclusive, unsealed generation may be removed on a failed copy.
        // Validate all descendants first; unknown entries are left for manual recovery.
        if (await io.exists(target)) {
          const partial = await inventory(target);
          if (
            partial.every((item) =>
              original.some((expected) => expected.name === item.name),
            )
          ) {
            await plainPath(base);
            await io.remove(target, { recursive: true });
          }
        }
        if ((await io.getChildren(base)).length === 0) await io.remove(base);
        throw error;
      }
    },
    async inspect(payload) {
      await verify(payload);
      const location = uri(payload);
      if (payload.kind !== "folder") await checkArchive(payloadPath(payload));
      const rootURI = services.io.newURI(
        payload.kind === "folder"
          ? location.replace(/\/?$/u, "/")
          : `jar:${location}!/`,
      );
      const extension = new Extension(rootURI);
      await extension.loadManifest();
      if (extension.errors.length || extension.type !== "extension")
        throw new LocalExtensionError("incompatible");
      if (!extension.id) throw new LocalExtensionError("missing-id");
      return parseMetadata({
        id: extension.id,
        name: extension.manifest.name,
        version: extension.manifest.version,
        required: permissionList([
          ...normalizePermissions(extension.getRequiredPermissions()),
          ...normalizePermissions(extension.getRequestedPermissions()),
        ]),
        optional: normalizePermissions(extension.manifestOptionalPermissions),
      });
    },
    async remove(payload) {
      parsePayload(payload);
      await ensureRoot(false);
      if (!(await io.exists(generationRoot(payload)))) return;
      await verify(payload);
      const base = generationRoot(payload);
      await plainPath(base);
      await io.remove(base, { recursive: true });
      const parent = paths.parent(base);
      await plainPath(parent);
      if ((await io.getChildren(parent)).length === 0) await io.remove(parent);
    },
    get: (id) => manager.getAddonByID(id),
    install: (payload) =>
      manager.installTemporaryAddon(file(payloadPath(payload))),
    listen(listener) {
      const events: Record<string, NativeEvent> = {
        onInstalling: "installing",
        onInstalled: "installed",
        onDisabled: "disabled",
        onEnabled: "enabled",
        onUninstalled: "removed",
      };
      const observer = Object.fromEntries(
        Object.entries(events).map(([key, event]) => [
          key,
          (addon: NativeAddon) => listener(event, addon),
        ]),
      );
      manager.addAddonListener(observer);
      return () => manager.removeAddonListener(observer);
    },
    open(window, target) {
      const view = asRecord(window);
      requireMethods(view, ["openTrustedLinkIn"]);
      (view.openTrustedLinkIn as (uri: string, where: string) => void)(
        target === "open-addons"
          ? "about:addons"
          : "about:debugging#/runtime/this-firefox",
        "tab",
      );
    },
  };
}
