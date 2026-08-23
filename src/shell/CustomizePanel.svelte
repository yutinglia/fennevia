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
  import CustomizePanelsSection from "./features/customize/CustomizePanelsSection.svelte";
  import CustomizeStyleSection from "./features/customize/CustomizeStyleSection.svelte";
  import FirefoxIcon from "./FirefoxIcon.svelte";
  import ToolbarWidgetGlyph from "./ToolbarWidgetGlyph.svelte";

  type Props = Readonly<{
    customizeSession?: CustomizeSessionController;
    localeId?: FenneviaLocale;
    onClose: () => void;
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
  let paletteDropActive = $state(false);

  const paletteLabel = (entry: ToolbarPaletteEntrySnapshot): string =>
    localizeWidgetLabel(localeId, {
      kind: entry.kind,
      label: entry.label,
    });

  let snapshot = $derived(props.state?.snapshot ?? null);
  let revision = $derived(props.state?.revision ?? 0);
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
    <p class="fennevia-customize__note" data-fennevia-customize-mode="">
      {snapshot.layoutCustomized
        ? t("customize.layoutCustomized")
        : t("customize.followingFirefox")}
    </p>
    <p class="fennevia-customize__note">
      {t("customize.keyboardAdd", { zone: addZoneName })}
    </p>

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
      <h3 class="fennevia-customize__heading">{t("customize.paletteAria")}</h3>
      {#if snapshot.palette.length === 0}
        <p class="fennevia-customize__empty">{t("customize.emptyPalette")}</p>
      {:else}
        <ul class="fennevia-customize__grid">
          {#each snapshot.palette as entry (entry.token)}
            <li>
              <button
                aria-label={t("customize.addWidgetAria", {
                  label: paletteLabel(entry),
                  zone: addZoneName,
                })}
                class="fennevia-control fennevia-customize__tile"
                data-fennevia-customize-add={entry.token}
                draggable="true"
                ondragend={handlePaletteDragEnd}
                ondragstart={(event) => handlePaletteDragStart(event, entry)}
                onkeydown={(event) => handlePaletteKeydown(event, entry)}
                onclick={() => addFromPalette(entry.token)}
                title={paletteLabel(entry)}
                type="button"
              >
                <span aria-hidden="true" class="fennevia-customize__item-icon">
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

    <CustomizePanelsSection
      customized={snapshot.panelsCustomized}
      {localeId}
      onResetPanels={() => void runEdit({ type: "reset-panels" })}
      onSetPanels={(panels) =>
        void runEdit({ panels, type: "set-panels" })}
      panels={snapshot.panels}
    />

    <CustomizeInteractionSection
      {localeId}
      onSetStyle={(style) => void runEdit({ style, type: "set-style" })}
      style={snapshot.style}
    />

    <CustomizeStyleSection
      {localeId}
      onResetStyle={() => void runEdit({ type: "reset-style" })}
      onSetStyle={(style) => void runEdit({ style, type: "set-style" })}
      style={snapshot.style}
    />

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
