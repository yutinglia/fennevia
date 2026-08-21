import type {
  ToolbarPaletteEntrySnapshot,
  ToolbarWidgetSnapshot,
} from "../app/toolbar-widgets-state";
import type { FirefoxIconName } from "./FirefoxIcon.svelte";
import type { ShellIconName } from "./ShellIcon.svelte";

const firefoxToolbarWidgetIconNames: ReadonlyMap<string, FirefoxIconName> =
  new Map<string, FirefoxIconName>([
    ["account", "account"],
    ["bookmark", "bookmark"],
    ["developer", "developer"],
    ["download", "download"],
    ["edit", "edit"],
    ["extension", "extensions"],
    ["firefox-view", "firefox-view"],
    ["fullscreen", "fullscreen"],
    ["history", "history"],
    ["library", "library"],
    ["new-window", "new-window"],
    ["print", "print"],
    ["private", "private"],
    ["screenshot", "screenshot"],
    ["sidebar", "sidebar"],
    ["translate", "translate"],
  ]);

const toolbarWidgetIconNames: ReadonlyMap<string, ShellIconName> = new Map<
  string,
  ShellIconName
>([
  ["shield", "shield"],
  ["zoom", "zoom"],
]);

export function resolveFirefoxToolbarWidgetIcon(
  widget: ToolbarWidgetSnapshot | ToolbarPaletteEntrySnapshot,
): FirefoxIconName | null {
  return firefoxToolbarWidgetIconNames.get(widget.icon) ?? null;
}

export function resolveToolbarWidgetIcon(
  widget: ToolbarWidgetSnapshot | ToolbarPaletteEntrySnapshot,
): ShellIconName {
  return toolbarWidgetIconNames.get(widget.icon) ?? "generic";
}
