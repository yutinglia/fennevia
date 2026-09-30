// SPDX-License-Identifier: MPL-2.0
import {
  copySettingsTransferRequest,
  type SettingsTransferRequest,
  type SettingsTransferResult,
} from "../../app/settings-transfer.ts";
import {
  isNativeRecord,
  type NativeRecord,
} from "../toolbar-widgets/support.ts";
import {
  parseSettingsFile,
  serializeSettingsFile,
  settingsFileMaxBytes,
  settingsFirefoxIds,
  settingsItems,
  SettingsFileError,
  type PortableSettings,
} from "./model.ts";
import {
  callSettingsNative,
  createNativeSettingsStore,
  SettingsNativeUnavailable,
} from "./native.ts";
import {
  applySettingsTransaction,
  captureSettingsPreferences,
  settingsPreferencesMatch,
  type SettingsPreferenceSnapshot,
} from "./transaction.ts";

type PreparedImport = Readonly<{
  token: string;
  settings: PortableSettings;
  expected: SettingsPreferenceSnapshot;
}>;

export function createSettingsTransfer(
  options: Readonly<{
    getWindow: () => NativeRecord;
    getSettings: () => PortableSettings;
    onChanged: () => void;
  }>,
) {
  let disposed = false;
  let busy = false;
  let generation = 0;
  let prepared: PreparedImport | null = null;
  let cancelSelection: (() => void) | null = null;

  const uuid = (window: NativeRecord): string => {
    if (!isNativeRecord(window.crypto)) throw new SettingsNativeUnavailable();
    const value = callSettingsNative(window.crypto, "randomUUID", []);
    if (typeof value !== "string" || !/^[0-9a-f-]{36}$/u.test(value))
      throw new SettingsNativeUnavailable();
    return value;
  };

  const choose = (
    window: NativeRecord,
    title: string,
    save: boolean,
  ): Promise<Readonly<{ path: string; replace: boolean }> | null> => {
    if (!isNativeRecord(window.Cc) || !isNativeRecord(window.Ci))
      throw new SettingsNativeUnavailable();
    const factory = window.Cc["@mozilla.org/filepicker;1"];
    const constants = window.Ci.nsIFilePicker;
    if (!isNativeRecord(factory) || !isNativeRecord(constants))
      throw new SettingsNativeUnavailable();
    const picker = callSettingsNative(factory, "createInstance", [constants]);
    if (!isNativeRecord(picker)) throw new SettingsNativeUnavailable();
    callSettingsNative(picker, "init", [
      window.browsingContext,
      title,
      save ? constants.modeSave : constants.modeOpen,
    ]);
    callSettingsNative(picker, "appendFilter", ["JSON", "*.json"]);
    picker.defaultExtension = "json";
    if (save) picker.defaultString = "fennevia-settings.json";
    return new Promise((resolve, reject) => {
      let finished = false;
      const finish = (
        selection: Readonly<{ path: string; replace: boolean }> | null,
      ): void => {
        if (finished) return;
        finished = true;
        cancelSelection = null;
        resolve(selection);
      };
      cancelSelection = () => finish(null);
      const fail = (error: unknown): void => {
        if (finished) return;
        finished = true;
        cancelSelection = null;
        reject(error);
      };
      try {
        callSettingsNative(picker, "open", [
          (result: unknown) => {
            if (finished) return;
            try {
              if (
                result !== constants.returnOK &&
                !(save && result === constants.returnReplace)
              ) {
                finish(null);
                return;
              }
              const file = picker.file;
              if (
                !isNativeRecord(file) ||
                typeof file.path !== "string" ||
                file.path === ""
              )
                throw new SettingsNativeUnavailable();
              finish({
                path: file.path,
                replace: result === constants.returnReplace,
              });
            } catch (error) {
              fail(error);
            }
          },
        ]);
      } catch (error) {
        fail(error);
      }
    });
  };

  const cancel = (): SettingsTransferResult => {
    generation += 1;
    prepared = null;
    cancelSelection?.();
    return { status: "cancelled" };
  };

  const transfer = async (
    input: SettingsTransferRequest,
  ): Promise<SettingsTransferResult> => {
    const request = copySettingsTransferRequest(input);
    if (request.type === "cancel") return cancel();
    if (disposed) return { status: "cancelled" };
    if (busy) return { status: "busy" };
    busy = true;
    const operation = ++generation;
    const active = (): boolean => !disposed && generation === operation;
    let publishing = false;
    try {
      const window = options.getWindow();
      const store = createNativeSettingsStore(window);
      if (request.type === "apply-import") {
        const candidate = prepared;
        prepared = null;
        if (!candidate || candidate.token !== request.token)
          return { status: "changed" };
        const status = applySettingsTransaction(
          store,
          candidate.settings,
          options.getSettings().layout,
          candidate.expected,
        );
        publishing = true;
        options.onChanged();
        return { status };
      }
      prepared = null;
      const io = window.IOUtils;
      if (!isNativeRecord(io)) throw new SettingsNativeUnavailable();
      const expected = captureSettingsPreferences(store);
      const exported =
        request.type === "export"
          ? serializeSettingsFile(options.getSettings())
          : null;
      const selection = await choose(
        window,
        request.title,
        request.type === "export",
      );
      if (!selection || !active()) return { status: "cancelled" };
      if (exported !== null) {
        const temporary = selection.path + ".fennevia-" + uuid(window) + ".tmp";
        // Reserve ownership before writing, so cleanup cannot delete a foreign
        // temporary file even if exclusive creation fails.
        await callSettingsNative(io, "writeUTF8", [
          temporary,
          "",
          { mode: "create" },
        ]);
        try {
          if (!active()) return { status: "cancelled" };
          await callSettingsNative(io, "writeUTF8", [
            temporary,
            exported,
            { mode: "overwrite", flush: true },
          ]);
          if (!active()) return { status: "cancelled" };
          await callSettingsNative(io, "move", [
            temporary,
            selection.path,
            { noOverwrite: !selection.replace },
          ]);
          return { status: "exported" };
        } finally {
          await callSettingsNative(io, "remove", [
            temporary,
            { ignoreAbsent: true },
          ]);
        }
      }
      const bytes = await callSettingsNative(io, "read", [
        selection.path,
        { maxBytes: settingsFileMaxBytes + 1 },
      ]);
      if (!active()) return { status: "cancelled" };
      if (!ArrayBuffer.isView(bytes)) throw new SettingsFileError("invalid");
      if (bytes.byteLength > settingsFileMaxBytes)
        throw new SettingsFileError("too-large");
      let text: string;
      try {
        text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
      } catch {
        throw new SettingsFileError("invalid");
      }
      const settings = parseSettingsFile(text);
      if (!settingsPreferencesMatch(store, expected))
        return { status: "changed" };
      const token = "settings-import-" + uuid(window);
      prepared = { token, settings, expected };
      return {
        status: "ready",
        token,
        widgetCount: settingsItems(settings.layout).length,
        missingCount: settingsFirefoxIds(settings.layout).filter(
          (id) => !store.exists(id),
        ).length,
      };
    } catch (error) {
      if (
        publishing ||
        (error instanceof Error &&
          error.message === "FENNEVIA_SETTINGS_ROLLBACK_FAILED")
      )
        throw error;
      if (!active()) return { status: "cancelled" };
      if (error instanceof SettingsFileError) return { status: error.status };
      if (error instanceof SettingsNativeUnavailable)
        return { status: "unavailable" };
      // Expected file/permission/native-operation failures are surfaced to the
      // user without exposing paths or file contents through the frontend.
      return { status: "failed" };
    } finally {
      busy = false;
    }
  };

  return Object.freeze({
    transfer,
    dispose(): void {
      disposed = true;
      cancel();
    },
  });
}
