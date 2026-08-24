// SPDX-License-Identifier: MPL-2.0

import type { ProjectWidgetId, ProjectWidgetStyleId } from "./contracts.ts";

const addressLauncherStyles = Object.freeze([
  "address-only",
  "with-site-status",
] as const);
const tabsStyles = Object.freeze(["tabs-only", "with-new-tab"] as const);
const noStyles = Object.freeze([]) as readonly ProjectWidgetStyleId[];

export function projectWidgetStyleOptions(
  id: ProjectWidgetId,
): readonly ProjectWidgetStyleId[] {
  if (id === "address-launcher") {
    return addressLauncherStyles;
  }
  if (id === "tabs") {
    return tabsStyles;
  }
  return noStyles;
}

export function defaultProjectWidgetStyle(
  id: ProjectWidgetId,
): ProjectWidgetStyleId | "" {
  return projectWidgetStyleOptions(id)[0] ?? "";
}

export function isProjectWidgetStyle(
  id: ProjectWidgetId,
  candidate: unknown,
): candidate is ProjectWidgetStyleId {
  return (
    typeof candidate === "string" &&
    projectWidgetStyleOptions(id).includes(candidate as ProjectWidgetStyleId)
  );
}
