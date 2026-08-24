import type {
  ToolbarPaletteEntrySnapshot,
  ToolbarWidgetPartSnapshot,
  ToolbarWidgetSnapshot,
} from "../app/toolbar-widgets-state";
import type { FirefoxIconName } from "./FirefoxIcon.svelte";
import type { ShellIconName } from "./ShellIcon.svelte";

const firefoxToolbarWidgetIconNames: ReadonlyMap<string, FirefoxIconName> =
  new Map<string, FirefoxIconName>([
    ["account", "account"],
    ["back", "back"],
    ["arrow-down", "arrow-down"],
    ["bookmark", "bookmark"],
    ["developer", "developer"],
    ["download", "download"],
    ["edit", "edit"],
    ["extension", "extensions"],
    ["forward", "forward"],
    ["firefox-view", "firefox-view"],
    ["fullscreen", "fullscreen"],
    ["history", "history"],
    ["home", "home"],
    ["library", "library"],
    ["new-window", "new-window"],
    ["print", "print"],
    ["private", "private"],
    ["plus", "plus"],
    ["reload", "reload"],
    ["screenshot", "screenshot"],
    ["sidebar", "sidebar"],
    ["settings", "settings"],
    ["tab", "tab"],
    ["translate", "translate"],
  ]);

const toolbarWidgetIconNames: ReadonlyMap<string, ShellIconName> = new Map<
  string,
  ShellIconName
>([
  ["center", "center"],
  ["shield", "shield"],
  ["close", "close"],
  ["column", "column"],
  ["expanded", "expanded"],
  ["maximize", "maximize"],
  ["minimize", "minimize"],
  ["padding", "padding"],
  ["row", "row"],
  ["zoom", "zoom"],
]);

export function resolveFirefoxToolbarWidgetIcon(
  widget:
    | ToolbarWidgetSnapshot
    | ToolbarWidgetPartSnapshot
    | ToolbarPaletteEntrySnapshot,
): FirefoxIconName | null {
  return firefoxToolbarWidgetIconNames.get(widget.icon) ?? null;
}

export function resolveToolbarWidgetIcon(
  widget:
    | ToolbarWidgetSnapshot
    | ToolbarWidgetPartSnapshot
    | ToolbarPaletteEntrySnapshot,
): ShellIconName {
  return toolbarWidgetIconNames.get(widget.icon) ?? "generic";
}
