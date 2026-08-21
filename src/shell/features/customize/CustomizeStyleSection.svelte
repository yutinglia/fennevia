<!-- SPDX-License-Identifier: MPL-2.0 -->
<script lang="ts">
  import {
    toolbarStyleDensities,
    toolbarStyleThemes,
    type ToolbarStyleColorKey,
    type ToolbarStyleSnapshot,
  } from "../../../app/toolbar-widgets-state";
  import {
    translate,
    type MessageKey,
    type MessageVars,
  } from "../../../app/i18n";
  import type { FenneviaLocale } from "../../../app/locale-state";

  type Props = Readonly<{
    localeId: FenneviaLocale;
    onResetStyle: () => void;
    onSetStyle: (style: Readonly<Partial<ToolbarStyleSnapshot>>) => void;
    style: ToolbarStyleSnapshot;
  }>;

  const props: Props = $props();
  const t = (key: MessageKey, vars?: MessageVars): string =>
    translate(props.localeId, key, vars);
  const themeLabel = (theme: string): string =>
    translate(props.localeId, ("customize.theme." + theme) as MessageKey);
  const densityLabel = (density: string): string =>
    translate(props.localeId, ("customize.density." + density) as MessageKey);

  // Empty swatches keep Firefox chrome design-token defaults. Hex values are
  // Acorn primitives from Firefox 153/154 color.tokens.json and
  // tokens-platform.css; #0062f9 is documented --color-blue-60.
  const accentPresets: readonly string[] = [
    "",
    "#0062f9",
    "#7844f0",
    "#9e3bc3",
    "#c91a6d",
    "#cf1748",
    "#d44100",
    "#008e00",
    "#00cadb",
    "#8f8f9d",
  ];
  const surfacePresets: readonly string[] = [
    "",
    "#ffffff",
    "#fbfbfe",
    "#f9f9fb",
    "#f0f0f4",
    "#42414d",
    "#2b2a33",
    "#1c1b22",
  ];
  const textPresets: readonly string[] = [
    "",
    "#15141a",
    "#5b5b66",
    "#8f8f9d",
    "#fbfbfe",
    "#ffffff",
  ];
  const borderPresets: readonly string[] = [
    "",
    "#ffffff",
    "#f0f0f4",
    "#bfbfc9",
    "#52525e",
    "#23222b",
  ];

  const radiusPresets: readonly number[] = [0, 4, 8, 12, 16];
  const blurPresets: readonly number[] = [0, 8, 18, 28];
  const opacityPresets: readonly number[] = [70, 85, 94, 100];
  const fontSizePresets: readonly number[] = [11, 12, 13, 14];
  const saturationPresets: readonly number[] = [100, 125, 145, 170];
  const shadowPresets: readonly number[] = [0, 25, 50, 75, 100];
  const motionPresets: readonly number[] = [0, 120, 180, 280];

  const setStyle = (style: Readonly<Partial<ToolbarStyleSnapshot>>) =>
    props.onSetStyle(style);
  const setStyleColor = (key: ToolbarStyleColorKey, value: string) =>
    setStyle({ [key]: value.toLowerCase() } as Readonly<
      Partial<ToolbarStyleSnapshot>
    >);
  const colorPickerValue = (value: string): string =>
    value === "" ? "#808080" : value;
  const resetStyle = () => props.onResetStyle();
</script>

<section aria-label={t("customize.style")} class="fennevia-customize__section">
  <h3 class="fennevia-customize__heading">{t("customize.style")}</h3>

  {#snippet colorRow(
    label: string,
    ariaLabel: string,
    key: ToolbarStyleColorKey,
    presets: readonly string[],
    defaultMark: string,
    dataName: string,
  )}
    {@const current = props.style[key]}
    {@const customSelected = current !== "" && !presets.includes(current)}
    <div
      class="fennevia-customize__style-row"
      role="group"
      aria-label={ariaLabel}
    >
      <span class="fennevia-customize__style-label">{label}</span>
      {#each presets as color (color === "" ? "default" : color)}
        <button
          aria-label={color === ""
            ? t("customize.colorDefaultAria", { label })
            : t("customize.colorLabelAria", { label, color })}
          aria-pressed={current === color}
          class="fennevia-control fennevia-customize__swatch"
          data-fennevia-customize-color={dataName}
          data-fennevia-customize-value={color === "" ? "default" : color}
          onclick={() => setStyleColor(key, color)}
          style:background-color={color === "" ? undefined : color}
          title={color === "" ? t("customize.colorDefaultTitle") : color}
          type="button">{color === "" ? defaultMark : ""}</button
        >
      {/each}
      <label class="fennevia-customize__color-wrap">
        <input
          aria-label={t("customize.colorCustomAria", { label })}
          class="fennevia-customize__color"
          class:fennevia-customize__color--custom={customSelected}
          data-fennevia-customize-color-input={dataName}
          oninput={(event) => setStyleColor(key, event.currentTarget.value)}
          title={t("customize.colorSwatchCustom")}
          type="color"
          value={colorPickerValue(current)}
        />
      </label>
    </div>
  {/snippet}

  <div
    class="fennevia-customize__style-row"
    role="group"
    aria-label={t("customize.theme")}
  >
    <span class="fennevia-customize__style-label">{t("customize.theme")}</span>
    {#each toolbarStyleThemes as theme (theme)}
      <button
        aria-pressed={props.style.theme === theme}
        class="fennevia-control fennevia-customize__option"
        data-fennevia-customize-theme={theme}
        onclick={() => setStyle({ theme })}
        type="button">{themeLabel(theme)}</button
      >
    {/each}
  </div>

  {@render colorRow(
    t("customize.labelAccent"),
    t("customize.colorAccent"),
    "accent",
    accentPresets,
    "A",
    "accent",
  )}
  {@render colorRow(
    t("customize.labelPanels"),
    t("customize.colorPanel"),
    "surface",
    surfacePresets,
    "D",
    "surface",
  )}
  {@render colorRow(
    t("customize.labelWindow"),
    t("customize.colorWindow"),
    "chromeBackground",
    surfacePresets,
    "D",
    "chrome",
  )}
  {@render colorRow(
    t("customize.labelType"),
    t("customize.colorText"),
    "text",
    textPresets,
    "D",
    "text",
  )}
  {@render colorRow(
    t("customize.labelBorder"),
    t("customize.colorBorder"),
    "border",
    borderPresets,
    "D",
    "border",
  )}

  <div
    class="fennevia-customize__style-row"
    role="group"
    aria-label={t("customize.density")}
  >
    <span class="fennevia-customize__style-label">{t("customize.density")}</span
    >
    {#each toolbarStyleDensities as density (density)}
      <button
        aria-pressed={props.style.density === density}
        class="fennevia-control fennevia-customize__option"
        data-fennevia-customize-density={density}
        onclick={() => setStyle({ density })}
        type="button">{densityLabel(density)}</button
      >
    {/each}
  </div>

  <div
    class="fennevia-customize__style-row"
    role="group"
    aria-label={t("customize.styleRadius")}
  >
    <span class="fennevia-customize__style-label"
      >{t("customize.labelCorners")}</span
    >
    {#each radiusPresets as radius (radius)}
      <button
        aria-pressed={props.style.radius === radius}
        class="fennevia-control fennevia-customize__option"
        data-fennevia-customize-radius={radius}
        onclick={() => setStyle({ radius })}
        type="button">{radius}px</button
      >
    {/each}
  </div>

  <div
    class="fennevia-customize__style-row"
    role="group"
    aria-label={t("customize.styleBlur")}
  >
    <span class="fennevia-customize__style-label"
      >{t("customize.labelBlur")}</span
    >
    {#each blurPresets as blur (blur)}
      <button
        aria-pressed={props.style.blur === blur}
        class="fennevia-control fennevia-customize__option"
        data-fennevia-customize-blur={blur}
        onclick={() => setStyle({ blur })}
        type="button">{blur}px</button
      >
    {/each}
  </div>

  <div
    class="fennevia-customize__style-row"
    role="group"
    aria-label={t("customize.styleOpacity")}
  >
    <span class="fennevia-customize__style-label"
      >{t("customize.labelOpacity")}</span
    >
    {#each opacityPresets as surfaceOpacity (surfaceOpacity)}
      <button
        aria-pressed={props.style.surfaceOpacity === surfaceOpacity}
        class="fennevia-control fennevia-customize__option"
        data-fennevia-customize-opacity={surfaceOpacity}
        onclick={() => setStyle({ surfaceOpacity })}
        type="button">{surfaceOpacity}%</button
      >
    {/each}
  </div>

  <div
    class="fennevia-customize__style-row"
    role="group"
    aria-label={t("customize.styleSaturation")}
  >
    <span class="fennevia-customize__style-label"
      >{t("customize.labelSaturate")}</span
    >
    {#each saturationPresets as saturation (saturation)}
      <button
        aria-pressed={props.style.saturation === saturation}
        class="fennevia-control fennevia-customize__option"
        data-fennevia-customize-saturation={saturation}
        onclick={() => setStyle({ saturation })}
        type="button">{saturation}%</button
      >
    {/each}
  </div>

  <div
    class="fennevia-customize__style-row"
    role="group"
    aria-label={t("customize.styleShadow")}
  >
    <span class="fennevia-customize__style-label"
      >{t("customize.labelShadow")}</span
    >
    {#each shadowPresets as shadow (shadow)}
      <button
        aria-pressed={props.style.shadow === shadow}
        class="fennevia-control fennevia-customize__option"
        data-fennevia-customize-shadow={shadow}
        onclick={() => setStyle({ shadow })}
        type="button">{shadow}</button
      >
    {/each}
  </div>

  <div
    class="fennevia-customize__style-row"
    role="group"
    aria-label={t("customize.styleMotion")}
  >
    <span class="fennevia-customize__style-label"
      >{t("customize.labelMotion")}</span
    >
    {#each motionPresets as motion (motion)}
      <button
        aria-pressed={props.style.motion === motion}
        class="fennevia-control fennevia-customize__option"
        data-fennevia-customize-motion={motion}
        onclick={() => setStyle({ motion })}
        type="button">{motion}ms</button
      >
    {/each}
  </div>

  <div
    class="fennevia-customize__style-row"
    role="group"
    aria-label={t("customize.styleFontSize")}
  >
    <span class="fennevia-customize__style-label"
      >{t("customize.labelSize")}</span
    >
    {#each fontSizePresets as fontSize (fontSize)}
      <button
        aria-pressed={props.style.fontSize === fontSize}
        class="fennevia-control fennevia-customize__option"
        data-fennevia-customize-font-size={fontSize}
        onclick={() => setStyle({ fontSize })}
        type="button">{fontSize}px</button
      >
    {/each}
  </div>

  <div class="fennevia-customize__style-row">
    <button
      class="fennevia-control fennevia-customize__reset"
      data-fennevia-customize-reset-style=""
      onclick={() => resetStyle()}
      type="button">{t("customize.resetStyle")}</button
    >
  </div>
</section>
