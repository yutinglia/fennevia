// SPDX-License-Identifier: MPL-2.0

import type { FenneviaLocale } from "../../../app/locale-state.ts";
import type {
  ToolbarPaletteEntrySnapshot,
  ToolbarPaletteFeatureGroup,
  ToolbarPaletteKind,
} from "../../../app/toolbar-widgets-state.ts";
import { localizeWidgetLabel } from "../../locale-ui.ts";

export const customizePaletteCategories = Object.freeze([
  "all",
  "feature",
  "browser",
  "firefox",
  "layout",
] as const);

export type CustomizePaletteCategory =
  (typeof customizePaletteCategories)[number];

export const customizePaletteGroupLayouts = Object.freeze([
  "regular",
  "feature-pair",
  "feature-primary-only",
  "feature-companion-only",
] as const);

export type CustomizePaletteGroupLayout =
  (typeof customizePaletteGroupLayouts)[number];

export type CustomizePaletteEntryGroup = Readonly<{
  entries: readonly ToolbarPaletteEntrySnapshot[];
  featureGroup: ToolbarPaletteFeatureGroup;
  key: string;
  layout: CustomizePaletteGroupLayout;
}>;

const customizePaletteCategoryRank = Object.freeze({
  browser: 1,
  feature: 0,
  firefox: 2,
  layout: 3,
} as const);

export function customizePaletteCategoryForKind(
  kind: ToolbarPaletteKind,
): Exclude<CustomizePaletteCategory, "all"> {
  if (kind === "feature" || kind === "feature-companion") {
    return "feature";
  }
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
    entries
      .map((entry, index) => Object.freeze({ entry, index }))
      .filter(({ entry }) => {
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
      })
      .sort((left, right) => {
        const categoryDifference =
          customizePaletteCategoryRank[
            customizePaletteCategoryForKind(left.entry.kind)
          ] -
          customizePaletteCategoryRank[
            customizePaletteCategoryForKind(right.entry.kind)
          ];
        return categoryDifference || left.index - right.index;
      })
      .map(({ entry }) => entry),
  );
}

export function groupCustomizePaletteEntries(
  entries: readonly ToolbarPaletteEntrySnapshot[],
): readonly CustomizePaletteEntryGroup[] {
  const mutableGroups: Array<{
    entries: ToolbarPaletteEntrySnapshot[];
    featureGroup: ToolbarPaletteFeatureGroup;
  }> = [];

  for (const entry of entries) {
    const previous = mutableGroups.at(-1);
    if (
      entry.featureGroup !== "" &&
      previous?.featureGroup === entry.featureGroup
    ) {
      previous.entries.push(entry);
      continue;
    }
    mutableGroups.push({
      entries: [entry],
      featureGroup: entry.featureGroup,
    });
  }

  return Object.freeze(
    mutableGroups.map((group) => {
      const hasPrimary = group.entries.some(
        (entry) => entry.kind === "feature",
      );
      const hasCompanion = group.entries.some(
        (entry) => entry.kind === "feature-companion",
      );
      const layout: CustomizePaletteGroupLayout =
        group.featureGroup === ""
          ? "regular"
          : hasPrimary && hasCompanion
            ? "feature-pair"
            : hasPrimary
              ? "feature-primary-only"
              : "feature-companion-only";
      return Object.freeze({
        entries: Object.freeze(group.entries),
        featureGroup: group.featureGroup,
        key: `${group.featureGroup || "entry"}:${group.entries[0]?.token ?? "missing"}`,
        layout,
      });
    }),
  );
}
