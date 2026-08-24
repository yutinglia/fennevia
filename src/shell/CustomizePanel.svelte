<script lang="ts">
  import type { CustomizeSessionController } from "../app/customize-session";
  import {
    clearToolbarWidgetDrag,
    createToolbarWidgetDropEdit,
    getActiveToolbarWidgetDrag,
    resolveToolbarWidgetDragImageOffset,
    serializeToolbarWidgetDrag,
    startToolbarWidgetDrag,
    subscribeToolbarWidgetDrag,
    toolbarWidgetDragMimeType,
    type ToolbarWidgetDragSource,
  } from "../app/toolbar-widget-drag";
  import {
    type BrowserToolbarWidgetsState,
    type BrowserToolbarWidgetsStateAdapter,
    type ToolbarPaletteEntrySnapshot,
    type ToolbarWidgetsEditOperation,
    type ToolbarZoneName,
  } from "../app/toolbar-widgets-state";
  import { translate, type MessageKey, type MessageVars } from "../app/i18n";
  import {
    defaultFenneviaLocale,
    type FenneviaLocale,
  } from "../app/locale-state";
  import { localizeWidgetLabel, zoneDisplayName } from "./locale-ui";
  import CustomizeInteractionSection from "./features/customize/CustomizeInteractionSection.svelte";
  import {
    customizePaletteCategories,
    filterCustomizePalette,
    type CustomizePaletteCategory,
  } from "./features/customize/customize-palette";
  import CustomizePanelsSection from "./features/customize/CustomizePanelsSection.svelte";
  import CustomizeStyleSection from "./features/customize/CustomizeStyleSection.svelte";
  import CustomizeTabList, {
    type CustomizeTabId,
  } from "./features/customize/CustomizeTabList.svelte";
  import FirefoxIcon from "./FirefoxIcon.svelte";
  import ToolbarWidgetGlyph from "./ToolbarWidgetGlyph.svelte";

  type Props = Readonly<{
    customizeSession?: CustomizeSessionController;
    localeId?: FenneviaLocale;
    onClose: () => void;
    onFatalError: (error: unknown) => void;
    state: BrowserToolbarWidgetsState | null;
    toolbarWidgets: BrowserToolbarWidgetsStateAdapter;
  }>;

  const props: Props = $props();
  let localeId: FenneviaLocale = $derived(
    props.localeId ?? defaultFenneviaLocale,
  );
  const t = (key: MessageKey, vars?: MessageVars): string =>
    translate(localeId, key, vars);

  let statusMessage = $state("");
  let activeDrag: ToolbarWidgetDragSource | null = $state(null);
  let paletteDropActive = $state(false);
  let paletteCategory: CustomizePaletteCategory = $state("all");
  let paletteQuery = $state("");
  let selectedTab: CustomizeTabId = $state("widgets");

  $effect(() =>
    subscribeToolbarWidgetDrag((source) => {
      activeDrag = source;
      paletteDropActive = false;
    }),
  );

  const paletteLabel = (entry: ToolbarPaletteEntrySnapshot): string =>
    localizeWidgetLabel(localeId, {
      kind: entry.kind,
      label: entry.label,
    });

  let snapshot = $derived(props.state?.snapshot ?? null);
  let revision = $derived(props.state?.revision ?? 0);
  let filteredPalette = $derived(
    filterCustomizePalette(
      snapshot?.palette ?? [],
      localeId,
      paletteQuery,
      paletteCategory,
    ),
  );
  let addZoneLabel: ToolbarZoneName = $state("top");
  let addZoneName = $derived(zoneDisplayName(localeId, addZoneLabel));

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
      statusMessage = t("customize.editFailed");
    }
  };

  const addFromPalette = (token: string) => {
    const zone = props.customizeSession?.lastFocusedZone() ?? "top";
    const rootNodes = snapshot?.layout[zone] ?? [];
    const rootContainer =
      rootNodes.length === 1 && rootNodes[0]?.type === "container"
        ? rootNodes[0]
        : null;
    void runEdit({
      index: rootContainer?.children.length ?? rootNodes.length,
      parentPath: rootContainer ? [0] : [],
      revision,
      token,
      type: "add-node",
      zone,
    });
  };

  const setAddZone = (event: Event): void => {
    const value =
      event.currentTarget instanceof HTMLSelectElement
        ? event.currentTarget.value
        : "";
    if (
      value === "top" ||
      value === "left" ||
      value === "right" ||
      value === "bottom"
    ) {
      props.customizeSession?.setLastFocusedZone(value);
      addZoneLabel = value;
    }
  };

  const resetLayout = () => void runEdit({ revision, type: "reset-layout" });

  const paletteCategoryLabel = (
    category: CustomizePaletteCategory,
  ): string => {
    switch (category) {
      case "browser":
        return t("customize.paletteCategoryBrowser");
      case "firefox":
        return t("customize.paletteCategoryFirefox");
      case "layout":
        return t("customize.paletteCategoryLayout");
      default:
        return t("customize.paletteCategoryAll");
    }
  };

  const setPaletteQuery = (event: Event): void => {
    paletteQuery =
      event.currentTarget instanceof HTMLInputElement
        ? event.currentTarget.value.slice(0, 128)
        : "";
  };

  const handleKeydown = (event: KeyboardEvent) => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      if (paletteQuery) {
        paletteQuery = "";
        return;
      }
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
    const tile =
      event.currentTarget instanceof HTMLElement ? event.currentTarget : null;
    if (tile) {
      const bounds = tile.getBoundingClientRect();
      const offset = resolveToolbarWidgetDragImageOffset(
        event.clientX,
        event.clientY,
        bounds,
        { blockSize: bounds.height, inlineSize: bounds.width },
      );
      transfer.setDragImage(
        tile,
        offset?.x ?? Math.round(bounds.width / 2),
        offset?.y ?? Math.round(bounds.height / 2),
      );
    }
  };

  const handlePaletteDragOver = (event: DragEvent) => {
    const source = getActiveToolbarWidgetDrag();
    if (source?.type !== "zone" && source?.type !== "layout-node") {
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
    if (source?.type !== "zone" && source?.type !== "layout-node") {
      return;
    }
    event.preventDefault();
    const operation = createToolbarWidgetDropEdit(
      source,
      { type: "palette" },
      revision,
      snapshot?.layout,
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
  aria-label={t("customize.panelAria")}
  aria-modal="false"
  lang={localeId}
  class="fennevia-customize"
  data-fennevia-customize-panel=""
  onkeydown={handleKeydown}
  role="dialog"
  tabindex="-1"
>
  <header class="fennevia-customize__header">
    <h2 class="fennevia-customize__title">{t("customize.title")}</h2>
    <button
      aria-label={t("customize.closeAria")}
      class="fennevia-control fennevia-customize__close"
      data-fennevia-customize-close=""
      data-fennevia-default-focus=""
      onclick={() => props.onClose()}
      title={t("window.close")}
      type="button"
    >
      <FirefoxIcon name="close" />
    </button>
  </header>

  {#if !snapshot?.canEdit}
    <p class="fennevia-customize__note">{t("customize.unavailable")}</p>
  {:else}
    <CustomizeTabList
      {localeId}
      onFatalError={props.onFatalError}
      onSelect={(tab) => (selectedTab = tab)}
      selected={selectedTab}
    />

    {#if selectedTab === "widgets"}
      <div
        aria-labelledby="fennevia-customize-tab-widgets"
        class="fennevia-customize__tabpanel"
        data-fennevia-customize-tabpanel="widgets"
        id="fennevia-customize-tabpanel-widgets"
        role="tabpanel"
      >
        <p class="fennevia-customize__note" data-fennevia-customize-mode="">
          {snapshot.layoutCustomized
            ? t("customize.layoutCustomized")
            : t("customize.followingFirefox")}
        </p>
        <p class="fennevia-customize__note">
          {t("customize.keyboardAdd", { zone: addZoneName })}
        </p>
        <p class="fennevia-customize__note">
          {t("customize.paletteDragHint")}
        </p>
        <label class="fennevia-customize__panel-field">
          <span>{t("customize.addToPanel")}</span>
          <select
            class="fennevia-control fennevia-customize__select"
            data-fennevia-customize-add-zone=""
            onchange={setAddZone}
            value={addZoneLabel}
          >
            <option value="top">{zoneDisplayName(localeId, "top")}</option>
            <option value="left">{zoneDisplayName(localeId, "left")}</option>
            <option value="right">{zoneDisplayName(localeId, "right")}</option>
            <option value="bottom">{zoneDisplayName(localeId, "bottom")}</option
            >
          </select>
        </label>

        <section
          aria-label={t("customize.paletteAria")}
          class="fennevia-customize__section"
          class:fennevia-customize__section--drop={paletteDropActive}
          data-fennevia-customize-palette=""
          ondragend={handlePaletteDragEnd}
          ondragleave={handlePaletteDragLeave}
          ondragover={handlePaletteDragOver}
          ondrop={handlePaletteDrop}
        >
          <h3 class="fennevia-customize__heading">
            {t("customize.paletteAria")}
          </h3>
          <div class="fennevia-customize__palette-tools">
            <label class="fennevia-customize__search-field">
              <span>{t("customize.paletteSearch")}</span>
              <input
                aria-label={t("customize.paletteSearch")}
                class="fennevia-control fennevia-customize__search"
                data-fennevia-customize-search=""
                maxlength="128"
                oninput={setPaletteQuery}
                placeholder={t("customize.paletteSearchPlaceholder")}
                type="search"
                value={paletteQuery}
              />
            </label>
            <div
              aria-label={t("customize.paletteCategoriesAria")}
              class="fennevia-customize__palette-categories"
              role="group"
            >
              {#each customizePaletteCategories as category (category)}
                <button
                  aria-pressed={paletteCategory === category}
                  class="fennevia-control fennevia-customize__palette-category"
                  data-fennevia-customize-category={category}
                  onclick={() => (paletteCategory = category)}
                  type="button">{paletteCategoryLabel(category)}</button
                >
              {/each}
            </div>
            <div class="fennevia-customize__palette-meta">
              <span class="fennevia-customize__destination">
                {t("customize.paletteDestination", { zone: addZoneName })}
              </span>
              <output aria-live="polite">
                {t("customize.paletteFilterCount", {
                  count: filteredPalette.length,
                })}
              </output>
            </div>
          </div>
          {#if snapshot.palette.length === 0}
            <p class="fennevia-customize__empty">
              {t("customize.emptyPalette")}
            </p>
          {:else if filteredPalette.length === 0}
            <p class="fennevia-customize__empty">
              {t("customize.paletteNoResults")}
            </p>
          {:else}
            <ul class="fennevia-customize__grid">
              {#each filteredPalette as entry (entry.token)}
                <li>
                  <button
                    aria-label={t("customize.addWidgetAria", {
                      label: paletteLabel(entry),
                      zone: addZoneName,
                    })}
                    class="fennevia-control fennevia-customize__tile"
                    data-fennevia-customize-add={entry.token}
                    data-fennevia-customize-dragging={activeDrag?.type ===
                      "palette" && activeDrag.token === entry.token
                      ? true
                      : undefined}
                    draggable="true"
                    ondragend={handlePaletteDragEnd}
                    ondragstart={(event) =>
                      handlePaletteDragStart(event, entry)}
                    onkeydown={(event) => handlePaletteKeydown(event, entry)}
                    onclick={() => addFromPalette(entry.token)}
                    title={paletteLabel(entry)}
                    type="button"
                  >
                    <span
                      aria-hidden="true"
                      class="fennevia-customize__item-icon"
                    >
                      {#if entry.kind === "special"}
                        <span class="fennevia-customize__item-space">·</span>
                      {:else}
                        <ToolbarWidgetGlyph widget={entry} />
                      {/if}
                    </span>
                    <span class="fennevia-customize__tile-label"
                      >{paletteLabel(entry)}</span
                    >
                  </button>
                </li>
              {/each}
            </ul>
          {/if}
        </section>
      </div>
    {:else if selectedTab === "panels"}
      <div
        aria-labelledby="fennevia-customize-tab-panels"
        class="fennevia-customize__tabpanel"
        data-fennevia-customize-tabpanel="panels"
        id="fennevia-customize-tabpanel-panels"
        role="tabpanel"
      >
        <CustomizePanelsSection
          allowMultiplePlacements={snapshot.allowMultiplePlacements}
          customized={snapshot.panelsCustomized}
          {localeId}
          onCleanLayout={() => void runEdit({ revision, type: "clean-layout" })}
          onResetPanels={() => void runEdit({ type: "reset-panels" })}
          onSetPanels={(panels) => void runEdit({ panels, type: "set-panels" })}
          onSetMultiplePlacements={(allow) =>
            void runEdit({
              allow,
              revision,
              type: "set-multiple-placements",
            })}
          panels={snapshot.panels}
        />
      </div>
    {:else if selectedTab === "interaction"}
      <div
        aria-labelledby="fennevia-customize-tab-interaction"
        class="fennevia-customize__tabpanel"
        data-fennevia-customize-tabpanel="interaction"
        id="fennevia-customize-tabpanel-interaction"
        role="tabpanel"
      >
        <CustomizeInteractionSection
          {localeId}
          onSetStyle={(style) => void runEdit({ style, type: "set-style" })}
          style={snapshot.style}
        />
      </div>
    {:else}
      <div
        aria-labelledby="fennevia-customize-tab-appearance"
        class="fennevia-customize__tabpanel"
        data-fennevia-customize-tabpanel="appearance"
        id="fennevia-customize-tabpanel-appearance"
        role="tabpanel"
      >
        <CustomizeStyleSection
          {localeId}
          onResetStyle={() => void runEdit({ type: "reset-style" })}
          onSetStyle={(style) => void runEdit({ style, type: "set-style" })}
          style={snapshot.style}
        />
      </div>
    {/if}

    <footer class="fennevia-customize__footer">
      <button
        class="fennevia-control fennevia-customize__reset"
        data-fennevia-customize-reset-layout=""
        disabled={!snapshot.layoutCustomized}
        onclick={() => resetLayout()}
        type="button">{t("customize.resetLayout")}</button
      >
      <output
        aria-live="polite"
        class="fennevia-customize__status"
        data-fennevia-customize-status="">{statusMessage}</output
      >
    </footer>
  {/if}
</div>
