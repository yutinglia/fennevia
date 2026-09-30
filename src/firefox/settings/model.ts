// SPDX-License-Identifier: MPL-2.0
import {
  hasAccessibleComposableCustomize,
  parseComposableCustomizeLayout,
  serializeComposableCustomizeLayout,
  type ComposableCustomizeLayout,
  type ComposableLayoutNode,
} from "../customize-layout.ts";
import {
  parseCustomizeStyle,
  parseCustomizePanels,
  serializeCustomizeStyle,
  serializeCustomizePanels,
  type CustomizeStyle,
  type CustomizePanels,
} from "../customize-model.ts";
import {
  skippedWidgetIdSet,
  readSpecialKind,
} from "../toolbar-widgets/support.ts";

export const settingsFileMaxBytes = 65_536;
export type PortableSettings = Readonly<{
  layout: ComposableCustomizeLayout;
  style: CustomizeStyle;
  panels: CustomizePanels;
}>;

export class SettingsFileError extends Error {
  readonly status: "invalid" | "unsupported" | "too-large";
  constructor(status: "invalid" | "unsupported" | "too-large") {
    super(
      "FENNEVIA_SETTINGS_FILE_" + status.toUpperCase().replaceAll("-", "_"),
    );
    this.name = "FenneviaSettingsFileError";
    this.status = status;
  }
}

function validateAccess(settings: PortableSettings): PortableSettings {
  if (
    settingsFirefoxIds(settings.layout).some(
      (id) => skippedWidgetIdSet.has(id) || readSpecialKind(id) !== null,
    )
  ) {
    throw new SettingsFileError("invalid");
  }
  const panels = settings.panels;
  if (
    !hasAccessibleComposableCustomize(settings.layout, {
      top: true,
      left: panels.leftPanelEnabled,
      right: panels.rightPanelEnabled,
      bottom: panels.bottomPanelEnabled,
    })
  )
    throw new SettingsFileError("invalid");
  return Object.freeze(settings);
}

export function parseSettingsFile(text: string): PortableSettings {
  if (typeof text !== "string") throw new SettingsFileError("invalid");
  if (
    text.length > settingsFileMaxBytes ||
    new TextEncoder().encode(text).byteLength > settingsFileMaxBytes
  )
    throw new SettingsFileError("too-large");
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(text.replace(/^\uFEFF/u, ""));
  } catch {
    throw new SettingsFileError("invalid");
  }
  if (
    !parsed ||
    typeof parsed !== "object" ||
    Array.isArray(parsed) ||
    parsed.format !== "fennevia-settings"
  )
    throw new SettingsFileError("invalid");
  if (parsed.version !== 1) throw new SettingsFileError("unsupported");
  if (
    !Object.keys(parsed).every((key) =>
      ["format", "version", "layout", "style", "panels"].includes(key),
    )
  )
    throw new SettingsFileError("invalid");
  const layout = parseComposableCustomizeLayout(JSON.stringify(parsed.layout));
  const style = parseCustomizeStyle(JSON.stringify(parsed.style));
  const panels = parseCustomizePanels(JSON.stringify(parsed.panels));
  if (!layout || !style || !panels) throw new SettingsFileError("invalid");
  // Adoption is an ownership ledger for the receiving profile, never authority
  // supplied by a portable file, including files made from another profile.
  return validateAccess({
    layout: Object.freeze({ ...layout, adopted: Object.freeze([]) }),
    style,
    panels,
  });
}

export function serializeSettingsFile(settings: PortableSettings): string {
  validateAccess(settings);
  const text =
    JSON.stringify(
      {
        format: "fennevia-settings",
        version: 1,
        layout: JSON.parse(
          serializeComposableCustomizeLayout({
            ...settings.layout,
            adopted: [],
          }),
        ),
        style: JSON.parse(serializeCustomizeStyle(settings.style)),
        panels: JSON.parse(serializeCustomizePanels(settings.panels)),
      },
      null,
      2,
    ) + "\n";
  parseSettingsFile(text);
  return text;
}

export function settingsItems(
  layout: ComposableCustomizeLayout,
): readonly Extract<ComposableLayoutNode, { type: "item" }>[] {
  const collect = (
    nodes: readonly ComposableLayoutNode[],
  ): Extract<ComposableLayoutNode, { type: "item" }>[] =>
    nodes.flatMap((node) =>
      node.type === "item" ? [node] : collect(node.children),
    );
  return Object.freeze(Object.values(layout.zones).flatMap(collect));
}

export function settingsFirefoxIds(
  layout: ComposableCustomizeLayout,
): readonly string[] {
  return Object.freeze([
    ...new Set(
      settingsItems(layout).flatMap((node) =>
        node.target.source === "firefox" ? [node.target.id] : [],
      ),
    ),
  ]);
}
