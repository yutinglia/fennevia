// SPDX-License-Identifier: MPL-2.0
import type { ToolbarStyleSnapshot } from "../../app/toolbar-widgets-state";

const CUSTOMIZE_STYLE_PROPERTIES = Object.freeze([
  "color-scheme",
  "font-size",
  "--fennevia-control-height",
  "--fennevia-edge-trigger-thickness",
  "--fennevia-edge-top-height",
  "--fennevia-focus-color",
  "--fennevia-glass-blur",
  "--fennevia-glass-border",
  "--fennevia-glass-muted",
  "--fennevia-glass-radius",
  "--fennevia-glass-saturation",
  "--fennevia-glass-separator",
  "--fennevia-glass-shadow",
  "--fennevia-glass-surface",
  "--fennevia-glass-text",
  "--fennevia-glass-tint",
  "--fennevia-hide-delay",
  "--fennevia-motion-duration",
  "--fennevia-selected-surface",
  "--fennevia-shortcut-tip-duration",
]);

const HEX_COLOR_PATTERN = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/u;
const DEFAULT_PANEL_SURFACE =
  "var(--panel-background-color, var(--toolbar-background-color))";
const DEFAULT_TOOLBAR_SURFACE =
  "var(--toolbar-background-color, var(--panel-background-color))";
const DEFAULT_GLASS_BLUR_PX = 18;
const DEFAULT_GLASS_RADIUS_PX = 4;
const DEFAULT_FONT_SIZE_PX = 12;
const DEFAULT_SURFACE_OPACITY = 94;
const DEFAULT_SATURATION = 145;
const DEFAULT_SHADOW = 50;
const DEFAULT_MOTION_MS = 180;

function hexToRgbComponents(hex: string): string | null {
  const match = HEX_COLOR_PATTERN.exec(hex);
  if (!match) {
    return null;
  }
  return [match[1], match[2], match[3]]
    .map((component) => String(parseInt(component, 16)))
    .join(" ");
}

function shadowFromIntensity(intensity: number): string {
  if (intensity === 0) {
    return "none";
  }
  const scale = intensity / DEFAULT_SHADOW;
  const y = Math.round(18 * scale);
  const blur = Math.round(54 * scale);
  const alpha = Math.round(28 * scale);
  const inset = Math.round(22 * scale);
  return `0 ${y}px ${blur}px color-mix(in srgb, var(--color-black, black) ${alpha}%, transparent), inset 0 1px 0 color-mix(in srgb, var(--color-white, white) ${inset}%, transparent)`;
}

export function clearCustomizeStyle(frame: HTMLElement): void {
  for (const property of CUSTOMIZE_STYLE_PROPERTIES) {
    frame.style.removeProperty(property);
  }
}

export function applyCustomizeStyle(
  frame: HTMLElement,
  style: ToolbarStyleSnapshot,
  options: Readonly<{ forcedColors: boolean; reducedMotion: boolean }>,
): void {
  clearCustomizeStyle(frame);
  frame.style.setProperty(
    "--fennevia-edge-trigger-thickness",
    `${style.edgeTriggerSize}px`,
  );
  frame.style.setProperty("--fennevia-hide-delay", `${style.autoHideDelay}ms`);
  frame.style.setProperty(
    "--fennevia-shortcut-tip-duration",
    `${style.shortcutHintDuration}ms`,
  );
  if (style.blur !== DEFAULT_GLASS_BLUR_PX) {
    frame.style.setProperty("--fennevia-glass-blur", `${style.blur}px`);
  }
  if (style.radius !== DEFAULT_GLASS_RADIUS_PX) {
    frame.style.setProperty("--fennevia-glass-radius", `${style.radius}px`);
  }
  if (style.fontSize !== DEFAULT_FONT_SIZE_PX) {
    frame.style.setProperty("font-size", `${style.fontSize}px`);
  }
  if (style.density === "compact") {
    frame.style.setProperty("--fennevia-control-height", "28px");
    frame.style.setProperty("--fennevia-edge-top-height", "48px");
  } else if (style.density === "comfortable") {
    frame.style.setProperty("--fennevia-control-height", "36px");
    frame.style.setProperty("--fennevia-edge-top-height", "64px");
  }
  if (!options.reducedMotion && style.motion !== DEFAULT_MOTION_MS) {
    frame.style.setProperty("--fennevia-motion-duration", `${style.motion}ms`);
  }
  if (options.forcedColors) {
    // Forced-colors mode keeps the system palette authoritative.
    return;
  }
  if (style.theme !== "auto") {
    frame.style.setProperty("color-scheme", style.theme);
  }
  const accent = hexToRgbComponents(style.accent);
  if (accent) {
    frame.style.setProperty("--fennevia-focus-color", `rgb(${accent})`);
    frame.style.setProperty(
      "--fennevia-selected-surface",
      `rgb(${accent} / 20%)`,
    );
  }
  const tintOpacity = Math.max(50, style.surfaceOpacity - 10);
  const surface = hexToRgbComponents(style.surface);
  if (surface) {
    frame.style.setProperty(
      "--fennevia-glass-surface",
      `rgb(${surface} / ${style.surfaceOpacity}%)`,
    );
    frame.style.setProperty(
      "--fennevia-glass-tint",
      `rgb(${surface} / ${tintOpacity}%)`,
    );
  } else if (style.surfaceOpacity !== DEFAULT_SURFACE_OPACITY) {
    frame.style.setProperty(
      "--fennevia-glass-surface",
      `color-mix(in srgb, ${DEFAULT_PANEL_SURFACE} ${style.surfaceOpacity}%, transparent)`,
    );
    frame.style.setProperty(
      "--fennevia-glass-tint",
      `color-mix(in srgb, ${DEFAULT_TOOLBAR_SURFACE} ${tintOpacity}%, transparent)`,
    );
  }
  const text = hexToRgbComponents(style.text);
  if (text) {
    frame.style.setProperty("--fennevia-glass-text", `rgb(${text})`);
    frame.style.setProperty("--fennevia-glass-muted", `rgb(${text} / 70%)`);
  }
  const border = hexToRgbComponents(style.border);
  if (border) {
    frame.style.setProperty("--fennevia-glass-border", `rgb(${border})`);
    frame.style.setProperty(
      "--fennevia-glass-separator",
      `rgb(${border} / 20%)`,
    );
  }
  if (style.saturation !== DEFAULT_SATURATION) {
    frame.style.setProperty(
      "--fennevia-glass-saturation",
      `${style.saturation}%`,
    );
  }
  if (style.shadow !== DEFAULT_SHADOW) {
    frame.style.setProperty(
      "--fennevia-glass-shadow",
      shadowFromIntensity(style.shadow),
    );
  }
}
