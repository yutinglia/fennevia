// SPDX-License-Identifier: MPL-2.0
import {
  serializeComposableCustomizeLayout,
  type ComposableCustomizeLayout,
} from "../customize-layout.ts";
import {
  serializeCustomizePanels,
  serializeCustomizeStyle,
} from "../customize-model.ts";
import { settingsFirefoxIds, type PortableSettings } from "./model.ts";

export const settingsPreferences = [
  "fennevia.customize.layout",
  "fennevia.customize.style",
  "fennevia.customize.panels",
] as const;
export type SettingsPreference = (typeof settingsPreferences)[number];
export type SettingsPreferenceSnapshot = Readonly<
  Record<SettingsPreference, string | null>
>;
export type WidgetPlacement = Readonly<{
  area: string;
  position: number;
}> | null;
export type SettingsStore = Readonly<{
  read: (name: SettingsPreference) => string | null;
  write: (name: SettingsPreference, value: string | null) => void;
  exists: (id: string) => boolean;
  placement: (id: string) => WidgetPlacement;
  place: (id: string, placement: WidgetPlacement) => void;
  isExtension: (id: string) => boolean;
  addonsArea: string;
}>;

export function captureSettingsPreferences(
  store: SettingsStore,
): SettingsPreferenceSnapshot {
  return Object.freeze(
    Object.fromEntries(
      settingsPreferences.map((name) => [name, store.read(name)]),
    ),
  ) as SettingsPreferenceSnapshot;
}

export function settingsPreferencesMatch(
  store: SettingsStore,
  expected: SettingsPreferenceSnapshot,
): boolean {
  return settingsPreferences.every(
    (name) => store.read(name) === expected[name],
  );
}

export function applySettingsTransaction(
  store: SettingsStore,
  settings: PortableSettings,
  currentLayout: ComposableCustomizeLayout,
  expected: SettingsPreferenceSnapshot,
): "imported" | "changed" | "failed" {
  if (!settingsPreferencesMatch(store, expected)) return "changed";
  const ids = settingsFirefoxIds(settings.layout);
  const adopted = new Set(
    currentLayout.adopted.filter((id) => ids.includes(id)),
  );
  const changes: {
    id: string;
    before: WidgetPlacement;
    after: WidgetPlacement;
  }[] = [];
  for (const id of currentLayout.adopted) {
    if (!ids.includes(id) && store.exists(id)) {
      changes.push({
        id,
        before: store.placement(id),
        after: store.isExtension(id)
          ? { area: store.addonsArea, position: 0 }
          : null,
      });
    }
  }
  for (const id of ids) {
    if (!store.exists(id) || adopted.has(id)) continue;
    const before = store.placement(id);
    if (before === null || before.area === store.addonsArea) {
      changes.push({ id, before, after: { area: "nav-bar", position: 0 } });
      adopted.add(id);
    }
  }
  const values: SettingsPreferenceSnapshot = {
    "fennevia.customize.layout": serializeComposableCustomizeLayout({
      ...settings.layout,
      adopted: [...adopted],
    }),
    "fennevia.customize.style": serializeCustomizeStyle(settings.style),
    "fennevia.customize.panels": serializeCustomizePanels(settings.panels),
  };
  const placed: typeof changes = [];
  const written: SettingsPreference[] = [];
  try {
    for (const change of changes) {
      placed.push(change);
      store.place(change.id, change.after);
    }
    for (const name of settingsPreferences) {
      written.push(name);
      store.write(name, values[name]);
    }
    return "imported";
  } catch {
    let rollbackFailed = false;
    for (const name of written.reverse()) {
      try {
        store.write(name, expected[name]);
      } catch {
        rollbackFailed = true;
      }
    }
    // Remove the attempted placements first, then restore original area order.
    // Re-inserting in reverse mutation order shifts untouched siblings.
    for (const change of placed) {
      try {
        store.place(change.id, null);
      } catch {
        rollbackFailed = true;
      }
    }
    for (const change of placed
      .filter((change) => change.before !== null)
      .sort(
        (a, b) =>
          a.before!.area.localeCompare(b.before!.area) ||
          a.before!.position - b.before!.position,
      )) {
      try {
        store.place(change.id, change.before);
      } catch {
        rollbackFailed = true;
      }
    }
    if (rollbackFailed) {
      const error = new Error("FENNEVIA_SETTINGS_ROLLBACK_FAILED");
      Object.defineProperty(error, "fenneviaPhase", {
        value: "settings-import-rollback",
      });
      throw error;
    }
    return "failed";
  }
}
