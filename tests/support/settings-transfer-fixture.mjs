// SPDX-License-Identifier: MPL-2.0
import { randomUUID } from "node:crypto";
import { createDefaultComposableCustomizeLayout } from "../../src/firefox/customize-layout.ts";
import {
  createDefaultShellPanelConfig,
  createDefaultToolbarStyle,
} from "../../src/app/toolbar-widgets-state.ts";
import { createSettingsTransfer } from "../../src/firefox/settings/transfer.ts";
import { createNativeSettingsStore } from "../../src/firefox/settings/native.ts";

export function createSettingsFixture() {
  const f = {
    settings: {
      layout: createDefaultComposableCustomizeLayout(),
      style: createDefaultToolbarStyle(),
      panels: createDefaultShellPanelConfig(),
    },
    prefs: new Map(),
    files: new Map(),
    widgets: new Set(),
    areas: new Map(),
    changed: 0,
    writes: [],
    placements: [],
    autoPick: true,
    selection: { path: "/fixture/settings.json", result: 0 },
    pickerCallback: null,
    beforeWrite: () => {},
    beforePlace: () => {},
  };
  const ui = {
    AREA_ADDONS: "unified-extensions-area",
    get areas() {
      return [...f.areas.keys()];
    },
    getWidgetIdsInArea: (area) => f.areas.get(area) ?? [],
    getWidget: (id) => ({ id, provider: f.widgets.has(id) ? "api" : "xul" }),
    getUnusedWidgets: () =>
      [...f.widgets]
        .filter((id) => !ui.getPlacementOfWidget(id))
        .map((id) => ({ id })),
    addListener() {},
    removeListener() {},
    isWebExtensionWidget: (id) => id.endsWith("-browser-action"),
    getPlacementOfWidget(id) {
      for (const [area, ids] of f.areas) {
        const position = ids.indexOf(id);
        if (position >= 0) return { area, position };
      }
      return null;
    },
    removeWidgetFromArea(id) {
      f.beforePlace(id, null);
      f.placements.push([id, null]);
      for (const ids of f.areas.values()) {
        const index = ids.indexOf(id);
        if (index >= 0) ids.splice(index, 1);
      }
    },
    addWidgetToArea(id, area, position) {
      f.beforePlace(id, area);
      for (const ids of f.areas.values()) {
        const index = ids.indexOf(id);
        if (index >= 0) ids.splice(index, 1);
      }
      const ids = f.areas.get(area) ?? [];
      ids.splice(position ?? ids.length, 0, id);
      f.areas.set(area, ids);
      f.placements.push([id, area, position]);
    },
  };
  const prefs = {
    addObserver() {},
    removeObserver() {},
    prefHasUserValue: (name) => f.prefs.has(name),
    getStringPref: (name) => f.prefs.get(name),
    setStringPref(name, value) {
      f.beforeWrite(name, value);
      f.writes.push([name, value]);
      f.prefs.set(name, value);
    },
    clearUserPref(name) {
      f.beforeWrite(name, null);
      f.writes.push([name, null]);
      f.prefs.delete(name);
    },
  };
  const constants = {
    modeSave: 1,
    modeOpen: 0,
    returnOK: 0,
    returnCancel: 1,
    returnReplace: 2,
  };
  const io = {
    async read(path, options) {
      return f.files.get(path).subarray(0, options.maxBytes);
    },
    async writeUTF8(path, text, options) {
      if (options.mode === "create" && f.files.has(path))
        throw new Error("EXISTS");
      f.files.set(path, Buffer.from(text));
    },
    async move(from, to, options) {
      if (options.noOverwrite && f.files.has(to)) throw new Error("EXISTS");
      f.files.set(to, f.files.get(from));
      f.files.delete(from);
    },
    async remove(path) {
      f.files.delete(path);
    },
  };
  const window = {
    Services: { prefs },
    CustomizableUI: ui,
    gNavToolbox: { palette: {} },
    IOUtils: io,
    crypto: { randomUUID },
    browsingContext: {},
    Ci: { nsIFilePicker: constants },
    Cc: {
      "@mozilla.org/filepicker;1": {
        createInstance() {
          return {
            init() {},
            appendFilter() {},
            get file() {
              return { path: f.selection.path };
            },
            open(callback) {
              f.pickerCallback = callback;
              if (f.autoPick)
                Promise.resolve().then(() => callback(f.selection.result));
            },
          };
        },
      },
    },
  };
  return Object.assign(f, {
    window,
    store: createNativeSettingsStore(window),
    transfer: createSettingsTransfer({
      getWindow: () => window,
      getSettings: () => f.settings,
      onChanged: () => {
        f.changed++;
      },
    }),
  });
}
