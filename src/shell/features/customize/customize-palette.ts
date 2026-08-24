// SPDX-License-Identifier: MPL-2.0

import type { FenneviaLocale } from "../../../app/locale-state.ts";
import type {
  ToolbarPaletteEntrySnapshot,
  ToolbarPaletteKind,
} from "../../../app/toolbar-widgets-state.ts";
import { localizeWidgetLabel } from "../../locale-ui.ts";

export const customizePaletteCategories = Object.freeze([
  "all",
  "browser",
  "firefox",
  "layout",
] as const);

export type CustomizePaletteCategory =
  (typeof customizePaletteCategories)[number];

export function customizePaletteCategoryForKind(
  kind: ToolbarPaletteKind,
): Exclude<CustomizePaletteCategory, "all"> {
  if (kind === "project" || kind === "fennevia") {
    return "browser";
  }
  if (kind === "built-in" || kind === "extension-action") {
    return "firefox";
  }
  return "layout";
}

export function filterCustomizePalette(
  entries: readonly ToolbarPaletteEntrySnapshot[],
  localeId: FenneviaLocale,
  query: string,
  category: CustomizePaletteCategory,
): readonly ToolbarPaletteEntrySnapshot[] {
  const normalizedQuery = query.normalize("NFKC").trim().toLocaleLowerCase();
  return Object.freeze(
    entries.filter((entry) => {
      if (
        category !== "all" &&
        customizePaletteCategoryForKind(entry.kind) !== category
      ) {
        return false;
      }
      return (
        normalizedQuery.length === 0 ||
        localizeWidgetLabel(localeId, entry)
          .normalize("NFKC")
          .toLocaleLowerCase()
          .includes(normalizedQuery)
      );
    }),
  );
}
