<script lang="ts">
  import {
    toolbarStyleDensities,
    toolbarStyleThemes,
    toolbarZoneNames,
    type BrowserToolbarWidgetsState,
    type BrowserToolbarWidgetsStateAdapter,
    type ToolbarWidgetSnapshot,
    type ToolbarWidgetsEditOperation,
    type ToolbarZoneName,
  } from "../app/toolbar-widgets-state";
  import ShellIcon from "./ShellIcon.svelte";
  import { resolveToolbarWidgetIcon } from "./toolbar-widget-icons";

  type Props = Readonly<{
    onClose: () => void;
    state: BrowserToolbarWidgetsState | null;
    toolbarWidgets: BrowserToolbarWidgetsStateAdapter;
  }>;

  const props: Props = $props();

  let selectedZone: ToolbarZoneName = $state("top");
  let statusMessage = $state("");

  const zoneLabels: Readonly<Record<ToolbarZoneName, string>> = {
    top: "Top",
    left: "Left",
    right: "Right",
    bottom: "Bottom",
  };

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

  const accentPresets: readonly string[] = [
    "",
    "#3b82f6",
    "#8b5cf6",
    "#ec4899",
    "#ef4444",
    "#f59e0b",
    "#10b981",
    "#14b8a6",
    "#64748b",
  ];

  const radiusPresets: readonly number[] = [0, 4, 8, 12, 16];
  const blurPresets: readonly number[] = [0, 8, 18, 28];
  const opacityPresets: readonly number[] = [70, 85, 94, 100];
  const fontSizePresets: readonly number[] = [11, 12, 13, 14];

  let snapshot = $derived(props.state?.snapshot ?? null);
  let revision = $derived(props.state?.revision ?? 0);
  let zoneWidgets = $derived(snapshot?.zones[selectedZone] ?? []);

  const widgetDisplayLabel = (widget: ToolbarWidgetSnapshot): string => {
    if (widget.label) {
      return widget.missing ? `${widget.label} (unavailable)` : widget.label;
    }
    if (widget.kind === "separator") {
      return "Separator";
    }
    if (widget.kind === "spacer") {
      return "Space";
    }
    if (widget.kind === "spring") {
      return "Flexible space";
    }
    return "Toolbar item";
  };

  const runEdit = async (operation: ToolbarWidgetsEditOperation) => {
    statusMessage = "";
    try {
      await props.toolbarWidgets.edit(operation);
    } catch {
      // Editing is an optional capability; a stale revision or missing
      // backend must never take the shell down.
      statusMessage =
        "That change could not be applied. The layout may have just changed; try again.";
    }
  };

  const addFromPalette = (token: string) =>
    void runEdit({
      index: zoneWidgets.length,
      revision,
      token,
      type: "add",
      zone: selectedZone,
    });

  const moveWithinZone = (fromIndex: number, toIndex: number) =>
    void runEdit({
      fromIndex,
      fromZone: selectedZone,
      revision,
      toIndex,
      toZone: selectedZone,
      type: "move",
    });

  const moveToZone = (fromIndex: number, toZone: ToolbarZoneName) =>
    void runEdit({
      fromIndex,
      fromZone: selectedZone,
      revision,
      toIndex: snapshot?.zones[toZone].length ?? 0,
      toZone,
      type: "move",
    });

  const removeAt = (index: number) =>
    void runEdit({ index, revision, type: "remove", zone: selectedZone });

  const resetLayout = () => void runEdit({ revision, type: "reset-layout" });

  const setStyle = (style: Readonly<Record<string, string | number>>) =>
    void runEdit({ style, type: "set-style" });

  const resetStyle = () => void runEdit({ type: "reset-style" });

  const unavailableNote =
    "Customization is unavailable in this window. The fixed Fennevia controls and native Firefox customize mode remain usable.";

  const handleKeydown = (event: KeyboardEvent) => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      props.onClose();
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
        ? "Using your Fennevia layout. Reset to follow the Firefox toolbar again."
        : "Following your Firefox toolbar layout until you make a change."}
    </p>

    <div
      aria-label="Choose a panel to edit"
      class="fennevia-customize__zones"
      role="group"
    >
      {#each toolbarZoneNames as zone (zone)}
        <button
          aria-pressed={selectedZone === zone}
          class="fennevia-control fennevia-customize__zone"
          data-fennevia-customize-zone={zone}
          onclick={() => {
            selectedZone = zone;
          }}
          type="button">{zoneLabels[zone]}</button
        >
      {/each}
    </div>

    <section
      aria-label="Widgets in the selected panel"
      class="fennevia-customize__section"
    >
      <h3 class="fennevia-customize__heading">
        {`In the ${zoneLabels[selectedZone].toLowerCase()} panel`}
      </h3>
      {#if zoneWidgets.length === 0}
        <p class="fennevia-customize__empty">No widgets in this panel yet.</p>
      {:else}
        <ol
          class="fennevia-customize__list"
          data-fennevia-customize-zone-list=""
        >
          {#each zoneWidgets as widget, index (`${index}-${widget.handle}-${widget.kind}`)}
            <li class="fennevia-customize__item">
              <span aria-hidden="true" class="fennevia-customize__item-icon">
                {#if widget.kind === "extension-action" && widget.iconUrl}
                  <img
                    alt=""
                    class="fennevia-customize__item-image"
                    src={widget.iconUrl}
                  />
                {:else if widget.kind === "separator" || widget.kind === "spacer" || widget.kind === "spring"}
                  <span class="fennevia-customize__item-space">·</span>
                {:else}
                  <ShellIcon name={resolveToolbarWidgetIcon(widget)} />
                {/if}
              </span>
              <span class="fennevia-customize__item-label"
                >{widgetDisplayLabel(widget)}</span
              >
              <span class="fennevia-customize__item-actions">
                <button
                  aria-label={`Move ${widgetDisplayLabel(widget)} earlier`}
                  class="fennevia-control fennevia-customize__action"
                  data-fennevia-customize-move="earlier"
                  disabled={index === 0}
                  onclick={() => moveWithinZone(index, index - 1)}
                  title="Move earlier"
                  type="button">↑</button
                >
                <button
                  aria-label={`Move ${widgetDisplayLabel(widget)} later`}
                  class="fennevia-control fennevia-customize__action"
                  data-fennevia-customize-move="later"
                  disabled={index === zoneWidgets.length - 1}
                  onclick={() => moveWithinZone(index, index + 1)}
                  title="Move later"
                  type="button">↓</button
                >
                {#each toolbarZoneNames as zone (zone)}
                  {#if zone !== selectedZone}
                    <button
                      aria-label={`Move ${widgetDisplayLabel(
                        widget,
                      )} to the ${zoneLabels[zone].toLowerCase()} panel`}
                      class="fennevia-control fennevia-customize__action"
                      data-fennevia-customize-move-zone={zone}
                      onclick={() => moveToZone(index, zone)}
                      title={`Move to ${zoneLabels[zone].toLowerCase()}`}
                      type="button">{zoneLabels[zone].slice(0, 1)}</button
                    >
                  {/if}
                {/each}
                <button
                  aria-label={`Remove ${widgetDisplayLabel(widget)}`}
                  class="fennevia-control fennevia-customize__action"
                  data-fennevia-customize-remove=""
                  onclick={() => removeAt(index)}
                  title="Remove"
                  type="button">×</button
                >
              </span>
            </li>
          {/each}
        </ol>
      {/if}
    </section>

    <section aria-label="Available widgets" class="fennevia-customize__section">
      <h3 class="fennevia-customize__heading">Available widgets</h3>
      {#if snapshot.palette.length === 0}
        <p class="fennevia-customize__empty">
          Every available widget is already placed.
        </p>
      {:else}
        <ul class="fennevia-customize__list" data-fennevia-customize-palette="">
          {#each snapshot.palette as entry (entry.token)}
            <li class="fennevia-customize__item">
              <span aria-hidden="true" class="fennevia-customize__item-icon">
                {#if entry.kind === "extension-action" && entry.iconUrl}
                  <img
                    alt=""
                    class="fennevia-customize__item-image"
                    src={entry.iconUrl}
                  />
                {:else if entry.kind === "special"}
                  <span class="fennevia-customize__item-space">·</span>
                {:else}
                  <ShellIcon name={resolveToolbarWidgetIcon(entry)} />
                {/if}
              </span>
              <span class="fennevia-customize__item-label">{entry.label}</span>
              <span class="fennevia-customize__item-actions">
                <button
                  aria-label={`Add ${entry.label} to the ${zoneLabels[
                    selectedZone
                  ].toLowerCase()} panel`}
                  class="fennevia-control fennevia-customize__action"
                  data-fennevia-customize-add={entry.token}
                  onclick={() => addFromPalette(entry.token)}
                  title="Add to selected panel"
                  type="button">+</button
                >
              </span>
            </li>
          {/each}
        </ul>
      {/if}
    </section>

    <section aria-label="Style" class="fennevia-customize__section">
      <h3 class="fennevia-customize__heading">Style</h3>

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

      <div
        class="fennevia-customize__style-row"
        role="group"
        aria-label="Accent color"
      >
        <span class="fennevia-customize__style-label">Accent</span>
        {#each accentPresets as accent (accent)}
          <button
            aria-label={accent === "" ? "Default accent" : `Accent ${accent}`}
            aria-pressed={snapshot.style.accent === accent}
            class="fennevia-control fennevia-customize__swatch"
            data-fennevia-customize-accent={accent === "" ? "default" : accent}
            onclick={() => setStyle({ accent })}
            style:background-color={accent === "" ? undefined : accent}
            title={accent === "" ? "Default" : accent}
            type="button">{accent === "" ? "A" : ""}</button
          >
        {/each}
      </div>

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
        aria-label="Font size"
      >
        <span class="fennevia-customize__style-label">Text</span>
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
