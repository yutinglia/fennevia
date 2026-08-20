<script lang="ts">
  import type { CustomizeSessionController } from "../app/customize-session";
  import {
    clearToolbarWidgetDrag,
    createToolbarWidgetDropEdit,
    getActiveToolbarWidgetDrag,
    serializeToolbarWidgetDrag,
    startToolbarWidgetDrag,
    toolbarWidgetDragMimeType,
  } from "../app/toolbar-widget-drag";
  import {
    toolbarStyleDensities,
    toolbarStyleThemes,
    type BrowserToolbarWidgetsState,
    type BrowserToolbarWidgetsStateAdapter,
    type ToolbarPaletteEntrySnapshot,
    type ToolbarStyleColorKey,
    type ToolbarStyleSnapshot,
    type ToolbarWidgetsEditOperation,
  } from "../app/toolbar-widgets-state";
  import ShellIcon from "./ShellIcon.svelte";
  import ToolbarWidgetGlyph from "./ToolbarWidgetGlyph.svelte";

  type Props = Readonly<{
    customizeSession?: CustomizeSessionController;
    onClose: () => void;
    state: BrowserToolbarWidgetsState | null;
    toolbarWidgets: BrowserToolbarWidgetsStateAdapter;
  }>;

  const props: Props = $props();

  let statusMessage = $state("");
  let paletteDropActive = $state(false);

  const themeLabels: Readonly<Record<string, string>> = {
    auto: "Auto",
    light: "Light",
    dark: "Dark",
  };

  const densityLabels: Readonly<Record<string, string>> = {
    compact: "Compact",
    cozy: "Cozy",
    comfortable: "Comfortable",
  };

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

  let snapshot = $derived(props.state?.snapshot ?? null);
  let revision = $derived(props.state?.revision ?? 0);
  let addZoneLabel = $state("top");

  $effect(() => {
    const session = props.customizeSession;
    if (!session) {
      addZoneLabel = "top";
      return;
    }
    addZoneLabel = session.lastFocusedZone();
    return session.subscribe((next) => {
      addZoneLabel = next.lastFocusedZone;
    });
  });

  const runEdit = async (operation: ToolbarWidgetsEditOperation) => {
    statusMessage = "";
    try {
      await props.toolbarWidgets.edit(operation);
    } catch {
      statusMessage =
        "That change could not be applied. The layout may have just changed; try again.";
    }
  };

  const addFromPalette = (token: string) => {
    const zone = props.customizeSession?.lastFocusedZone() ?? "top";
    const index = snapshot?.zones[zone].length ?? 0;
    void runEdit({
      index,
      revision,
      token,
      type: "add",
      zone,
    });
  };

  const resetLayout = () => void runEdit({ revision, type: "reset-layout" });

  const setStyle = (style: Readonly<Partial<ToolbarStyleSnapshot>>) =>
    void runEdit({ style, type: "set-style" });

  const setStyleColor = (key: ToolbarStyleColorKey, value: string) =>
    setStyle({ [key]: value.toLowerCase() } as Readonly<
      Partial<ToolbarStyleSnapshot>
    >);

  const colorPickerValue = (value: string): string =>
    value === "" ? "#808080" : value;

  const resetStyle = () => void runEdit({ type: "reset-style" });

  const unavailableNote =
    "Customization is unavailable in this window. The fixed Fennevia controls and native Firefox customize mode remain usable.";
  const emptyPaletteNote =
    "Every available widget is already placed. Drop a widget here to remove it from a panel.";

  const handleKeydown = (event: KeyboardEvent) => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      props.onClose();
    }
  };

  const handlePaletteDragStart = (
    event: DragEvent,
    entry: ToolbarPaletteEntrySnapshot,
  ) => {
    const transfer = event.dataTransfer;
    if (!transfer) {
      return;
    }
    const source = startToolbarWidgetDrag({
      token: entry.token,
      type: "palette",
    });
    transfer.effectAllowed = "copyMove";
    transfer.setData(
      toolbarWidgetDragMimeType,
      serializeToolbarWidgetDrag(source),
    );
    transfer.setData("text/plain", entry.token);
  };

  const handlePaletteDragOver = (event: DragEvent) => {
    const source = getActiveToolbarWidgetDrag();
    if (source?.type !== "zone") {
      return;
    }
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = "move";
    }
    paletteDropActive = true;
  };

  const handlePaletteDragLeave = (event: DragEvent) => {
    const current = event.currentTarget;
    const related = event.relatedTarget;
    if (
      current instanceof Node &&
      related instanceof Node &&
      current.contains(related)
    ) {
      return;
    }
    paletteDropActive = false;
  };

  const handlePaletteDrop = (event: DragEvent) => {
    const source = getActiveToolbarWidgetDrag();
    paletteDropActive = false;
    if (source?.type !== "zone") {
      return;
    }
    event.preventDefault();
    const operation = createToolbarWidgetDropEdit(
      source,
      { type: "palette" },
      revision,
    );
    clearToolbarWidgetDrag();
    if (operation) {
      void runEdit(operation);
    }
  };

  const handlePaletteDragEnd = () => {
    paletteDropActive = false;
    clearToolbarWidgetDrag();
  };

  const handlePaletteKeydown = (
    event: KeyboardEvent,
    entry: ToolbarPaletteEntrySnapshot,
  ) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      addFromPalette(entry.token);
    }
  };
</script>

<div
  aria-label="Customize Fennevia shell"
  aria-modal="false"
  class="fennevia-customize"
  data-fennevia-customize-panel=""
  onkeydown={handleKeydown}
  role="dialog"
  tabindex="-1"
>
  <header class="fennevia-customize__header">
    <h2 class="fennevia-customize__title">Customize Fennevia</h2>
    <button
      aria-label="Close customize panel"
      class="fennevia-control fennevia-customize__close"
      data-fennevia-customize-close=""
      data-fennevia-default-focus=""
      onclick={() => props.onClose()}
      title="Close"
      type="button"
    >
      <ShellIcon name="close" />
    </button>
  </header>

  {#if !snapshot?.canEdit}
    <p class="fennevia-customize__note">{unavailableNote}</p>
  {:else}
    <p class="fennevia-customize__note" data-fennevia-customize-mode="">
      {snapshot.layoutCustomized
        ? "Using your Fennevia layout. Drag widgets onto the four edge panels. Drop them here to remove. Reset to follow the Firefox toolbar again."
        : "Following your Firefox toolbar until you make a change. Drag widgets onto the four edge panels."}
    </p>
    <p class="fennevia-customize__note">
      {`Keyboard add targets the ${addZoneLabel} panel. Press Delete on a placed widget to remove it.`}
    </p>

    <section
      aria-label="Available widgets"
      class="fennevia-customize__section"
      class:fennevia-customize__section--drop={paletteDropActive}
      data-fennevia-customize-palette=""
      ondragend={handlePaletteDragEnd}
      ondragleave={handlePaletteDragLeave}
      ondragover={handlePaletteDragOver}
      ondrop={handlePaletteDrop}
    >
      <h3 class="fennevia-customize__heading">Available widgets</h3>
      {#if snapshot.palette.length === 0}
        <p class="fennevia-customize__empty">{emptyPaletteNote}</p>
      {:else}
        <ul class="fennevia-customize__grid">
          {#each snapshot.palette as entry (entry.token)}
            <li>
              <button
                aria-label={`Add ${entry.label} to the ${addZoneLabel} panel`}
                class="fennevia-control fennevia-customize__tile"
                data-fennevia-customize-add={entry.token}
                draggable="true"
                ondragend={handlePaletteDragEnd}
                ondragstart={(event) => handlePaletteDragStart(event, entry)}
                onkeydown={(event) => handlePaletteKeydown(event, entry)}
                onclick={() => addFromPalette(entry.token)}
                title={entry.label}
                type="button"
              >
                <span aria-hidden="true" class="fennevia-customize__item-icon">
                  {#if entry.kind === "special"}
                    <span class="fennevia-customize__item-space">·</span>
                  {:else}
                    <ToolbarWidgetGlyph widget={entry} />
                  {/if}
                </span>
                <span class="fennevia-customize__tile-label">{entry.label}</span
                >
              </button>
            </li>
          {/each}
        </ul>
      {/if}
    </section>

    <section aria-label="Style" class="fennevia-customize__section">
      <h3 class="fennevia-customize__heading">Style</h3>

      {#snippet colorRow(
        label: string,
        ariaLabel: string,
        key: ToolbarStyleColorKey,
        presets: readonly string[],
        defaultMark: string,
        dataName: string,
      )}
        {@const current = snapshot.style[key]}
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
                ? `Default ${label}`
                : `${label} ${color}`}
              aria-pressed={current === color}
              class="fennevia-control fennevia-customize__swatch"
              data-fennevia-customize-color={dataName}
              data-fennevia-customize-value={color === "" ? "default" : color}
              onclick={() => setStyleColor(key, color)}
              style:background-color={color === "" ? undefined : color}
              title={color === "" ? "Default" : color}
              type="button">{color === "" ? defaultMark : ""}</button
            >
          {/each}
          <label class="fennevia-customize__color-wrap">
            <input
              aria-label={`Custom ${label} color`}
              class="fennevia-customize__color"
              class:fennevia-customize__color--custom={customSelected}
              data-fennevia-customize-color-input={dataName}
              oninput={(event) => setStyleColor(key, event.currentTarget.value)}
              title="Custom color"
              type="color"
              value={colorPickerValue(current)}
            />
          </label>
        </div>
      {/snippet}

      <div
        class="fennevia-customize__style-row"
        role="group"
        aria-label="Theme"
      >
        <span class="fennevia-customize__style-label">Theme</span>
        {#each toolbarStyleThemes as theme (theme)}
          <button
            aria-pressed={snapshot.style.theme === theme}
            class="fennevia-control fennevia-customize__option"
            data-fennevia-customize-theme={theme}
            onclick={() => setStyle({ theme })}
            type="button">{themeLabels[theme]}</button
          >
        {/each}
      </div>

      {@render colorRow(
        "Accent",
        "Accent color",
        "accent",
        accentPresets,
        "A",
        "accent",
      )}
      {@render colorRow(
        "Panels",
        "Panel background",
        "surface",
        surfacePresets,
        "D",
        "surface",
      )}
      {@render colorRow(
        "Window",
        "Window background",
        "chromeBackground",
        surfacePresets,
        "D",
        "chrome",
      )}
      {@render colorRow("Type", "Text color", "text", textPresets, "D", "text")}
      {@render colorRow(
        "Border",
        "Border color",
        "border",
        borderPresets,
        "D",
        "border",
      )}

      <div
        class="fennevia-customize__style-row"
        role="group"
        aria-label="Density"
      >
        <span class="fennevia-customize__style-label">Density</span>
        {#each toolbarStyleDensities as density (density)}
          <button
            aria-pressed={snapshot.style.density === density}
            class="fennevia-control fennevia-customize__option"
            data-fennevia-customize-density={density}
            onclick={() => setStyle({ density })}
            type="button">{densityLabels[density]}</button
          >
        {/each}
      </div>

      <div
        class="fennevia-customize__style-row"
        role="group"
        aria-label="Corner radius"
      >
        <span class="fennevia-customize__style-label">Corners</span>
        {#each radiusPresets as radius (radius)}
          <button
            aria-pressed={snapshot.style.radius === radius}
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
        aria-label="Glass blur"
      >
        <span class="fennevia-customize__style-label">Blur</span>
        {#each blurPresets as blur (blur)}
          <button
            aria-pressed={snapshot.style.blur === blur}
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
        aria-label="Surface opacity"
      >
        <span class="fennevia-customize__style-label">Opacity</span>
        {#each opacityPresets as surfaceOpacity (surfaceOpacity)}
          <button
            aria-pressed={snapshot.style.surfaceOpacity === surfaceOpacity}
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
        aria-label="Glass saturation"
      >
        <span class="fennevia-customize__style-label">Saturate</span>
        {#each saturationPresets as saturation (saturation)}
          <button
            aria-pressed={snapshot.style.saturation === saturation}
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
        aria-label="Shadow intensity"
      >
        <span class="fennevia-customize__style-label">Shadow</span>
        {#each shadowPresets as shadow (shadow)}
          <button
            aria-pressed={snapshot.style.shadow === shadow}
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
        aria-label="Motion duration"
      >
        <span class="fennevia-customize__style-label">Motion</span>
        {#each motionPresets as motion (motion)}
          <button
            aria-pressed={snapshot.style.motion === motion}
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
        aria-label="Font size"
      >
        <span class="fennevia-customize__style-label">Size</span>
        {#each fontSizePresets as fontSize (fontSize)}
          <button
            aria-pressed={snapshot.style.fontSize === fontSize}
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
          type="button">Reset style</button
        >
      </div>
    </section>

    <footer class="fennevia-customize__footer">
      <button
        class="fennevia-control fennevia-customize__reset"
        data-fennevia-customize-reset-layout=""
        disabled={!snapshot.layoutCustomized}
        onclick={() => resetLayout()}
        type="button">Reset layout</button
      >
      <output
        aria-live="polite"
        class="fennevia-customize__status"
        data-fennevia-customize-status="">{statusMessage}</output
      >
    </footer>
  {/if}
</div>
