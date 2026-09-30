// SPDX-License-Identifier: MPL-2.0
import {
  isFunction,
  isNativeRecord,
  readPrefs,
  readCustomizableUi,
  isExtensionWidgetId,
  readAddonsArea,
  skippedWidgetIdSet,
  readSpecialKind,
  type NativeRecord,
} from "../toolbar-widgets/support.ts";
import type { SettingsStore, WidgetPlacement } from "./transaction.ts";

export class SettingsNativeUnavailable extends Error {
  constructor() {
    super("FENNEVIA_SETTINGS_NATIVE_UNAVAILABLE");
  }
}

export function callSettingsNative(
  owner: NativeRecord,
  method: string,
  args: unknown[],
): unknown {
  const fn = owner[method];
  if (!isFunction(fn)) throw new SettingsNativeUnavailable();
  return Reflect.apply(fn, owner, args);
}

export function createNativeSettingsStore(window: NativeRecord): SettingsStore {
  const prefs = readPrefs(window);
  const ui = readCustomizableUi(window);
  if (
    !prefs ||
    !ui ||
    !isFunction(prefs.prefHasUserValue) ||
    !isFunction(ui.getPlacementOfWidget) ||
    !isFunction(ui.addWidgetToArea) ||
    !isFunction(ui.removeWidgetFromArea)
  )
    throw new SettingsNativeUnavailable();
  return Object.freeze({
    read(name) {
      if (!callSettingsNative(prefs, "prefHasUserValue", [name])) return null;
      const value = callSettingsNative(prefs, "getStringPref", [name]);
      if (typeof value !== "string") throw new SettingsNativeUnavailable();
      return value;
    },
    write(name, value) {
      if (value === null) callSettingsNative(prefs, "clearUserPref", [name]);
      else callSettingsNative(prefs, "setStringPref", [name, value]);
    },
    exists(id) {
      // getWidget also wraps arbitrary XUL IDs, including non-widget DOM.
      // Only the same placed/unused inventory used by Customize is eligible.
      if (skippedWidgetIdSet.has(id) || readSpecialKind(id) !== null)
        return false;
      const areas = ui.areas;
      if (!Array.isArray(areas)) throw new SettingsNativeUnavailable();
      for (const area of areas) {
        if (typeof area !== "string") throw new SettingsNativeUnavailable();
        const ids = callSettingsNative(ui, "getWidgetIdsInArea", [area]);
        if (!Array.isArray(ids)) throw new SettingsNativeUnavailable();
        if (ids.includes(id)) return true;
      }
      const toolbox = window.gNavToolbox;
      if (!isNativeRecord(toolbox) || !isNativeRecord(toolbox.palette))
        throw new SettingsNativeUnavailable();
      const unused = callSettingsNative(ui, "getUnusedWidgets", [
        toolbox.palette,
      ]);
      if (!Array.isArray(unused)) throw new SettingsNativeUnavailable();
      return unused.some(
        (widget) => isNativeRecord(widget) && widget.id === id,
      );
    },
    placement(id): WidgetPlacement {
      const value = callSettingsNative(ui, "getPlacementOfWidget", [id]);
      if (value === null || value === undefined) return null;
      if (
        !isNativeRecord(value) ||
        typeof value.area !== "string" ||
        value.area === "" ||
        !Number.isInteger(value.position) ||
        (value.position as number) < 0
      )
        throw new SettingsNativeUnavailable();
      return Object.freeze({
        area: value.area,
        position: value.position as number,
      });
    },
    place(id, placement) {
      if (placement === null)
        callSettingsNative(ui, "removeWidgetFromArea", [id]);
      else
        callSettingsNative(ui, "addWidgetToArea", [
          id,
          placement.area,
          placement.position,
        ]);
    },
    isExtension(id) {
      return isExtensionWidgetId(ui, id);
    },
    addonsArea: readAddonsArea(ui),
  });
}
