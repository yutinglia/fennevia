import type {
  ToolbarPaletteEntrySnapshot,
  ToolbarWidgetSnapshot,
} from "../app/toolbar-widgets-state";
import type { ShellIconName } from "./ShellIcon.svelte";

const toolbarWidgetIconNames: ReadonlyMap<string, ShellIconName> = new Map<
  string,
  ShellIconName
>([
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
  ["shield", "shield"],
  ["sidebar", "sidebar"],
  ["zoom", "zoom"],
]);

export function resolveToolbarWidgetIcon(
  widget: ToolbarWidgetSnapshot | ToolbarPaletteEntrySnapshot,
): ShellIconName {
  return toolbarWidgetIconNames.get(widget.icon) ?? "generic";
}
