<!-- SPDX-License-Identifier: MPL-2.0 -->
<script lang="ts">
  import {
    isEdgePanelDodgeMode,
    isProgressLightSource,
    type EdgePanelDodgeMode,
    type ProgressLightSource,
    type ShellPanelConfigSnapshot,
  } from "../../../app/toolbar-widgets-state";
  import { translate, type MessageKey } from "../../../app/i18n";
  import type { FenneviaLocale } from "../../../app/locale-state";

  type Props = Readonly<{
    allowMultiplePlacements: boolean;
    customized: boolean;
    localeId: FenneviaLocale;
    onCleanLayout: () => void;
    onResetPanels: () => void;
    onSetPanels: (panels: Readonly<Partial<ShellPanelConfigSnapshot>>) => void;
    onSetMultiplePlacements: (allow: boolean) => void;
    panels: ShellPanelConfigSnapshot;
  }>;

  const props: Props = $props();
  const t = (key: MessageKey): string => translate(props.localeId, key);
  let cleanConfirmOpen = $state(false);
  let cleanButton: HTMLButtonElement | undefined = $state();

  const focusOnMount = (node: HTMLElement): void => {
    node.focus({ preventScroll: true });
  };

  const cancelClean = (): void => {
    cleanConfirmOpen = false;
    cleanButton?.focus({ preventScroll: true });
  };

  const confirmClean = (): void => {
    cleanConfirmOpen = false;
    cleanButton?.focus({ preventScroll: true });
    props.onCleanLayout();
  };

  const handleCleanConfirmKeydown = (event: KeyboardEvent): void => {
    if (event.key !== "Escape") {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    cancelClean();
  };

  const setProgressLight = (edge: "bottom" | "top", event: Event): void => {
    const value =
      event.currentTarget instanceof HTMLSelectElement
        ? event.currentTarget.value
        : "";
    if (!isProgressLightSource(value)) {
      return;
    }
    const source = value as ProgressLightSource;
    props.onSetPanels(
      edge === "top"
        ? { topProgressLight: source }
        : { bottomProgressLight: source },
    );
  };

  const setPanelEnabled = (
    edge: "bottom" | "left" | "right",
    event: Event,
  ): void => {
    const checked =
      event.currentTarget instanceof HTMLInputElement
        ? event.currentTarget.checked
        : false;
    props.onSetPanels(
      edge === "left"
        ? { leftPanelEnabled: checked }
        : edge === "right"
          ? { rightPanelEnabled: checked }
          : { bottomPanelEnabled: checked },
    );
  };

  const setAllowCompactWindow = (event: Event): void => {
    const checked =
      event.currentTarget instanceof HTMLInputElement
        ? event.currentTarget.checked
        : false;
    props.onSetPanels({ allowCompactWindow: checked });
  };

  const setPanelDodgeMode = (event: Event): void => {
    const value =
      event.currentTarget instanceof HTMLSelectElement
        ? event.currentTarget.value
        : "";
    if (!isEdgePanelDodgeMode(value)) {
      return;
    }
    props.onSetPanels({ panelDodgeMode: value as EdgePanelDodgeMode });
  };
</script>

<fieldset
  class="fennevia-customize__section fennevia-customize__panel-config"
  data-fennevia-customize-panels=""
>
  <legend class="fennevia-customize__heading">
    {t("customize.panels")}
  </legend>
  <p class="fennevia-customize__interaction-help">
    {t("customize.panelsHelp")}
  </p>

  <label class="fennevia-customize__panel-field">
    <span>{t("customize.panelDodgeMode")}</span>
    <select
      class="fennevia-control fennevia-customize__select"
      data-fennevia-customize-panel-dodge=""
      onchange={setPanelDodgeMode}
      value={props.panels.panelDodgeMode}
    >
      <option value="single-dynamic">
        {t("customize.panelDodge.singleDynamic")}
      </option>
      <option value="single-reserved">
        {t("customize.panelDodge.singleReserved")}
      </option>
      <option value="multiple-dynamic">
        {t("customize.panelDodge.multipleDynamic")}
      </option>
      <option value="multiple-reserved">
        {t("customize.panelDodge.multipleReserved")}
      </option>
    </select>
  </label>
  <p class="fennevia-customize__interaction-help">
    {t("customize.panelDodgeHelp")}
  </p>

  <label class="fennevia-customize__panel-toggle">
    <input
      checked={props.allowMultiplePlacements}
      data-fennevia-customize-multiple-placements=""
      onchange={(event) =>
        props.onSetMultiplePlacements(
          event.currentTarget instanceof HTMLInputElement
            ? event.currentTarget.checked
            : false,
        )}
      type="checkbox"
    />
    <span>{t("customize.multiplePlacements")}</span>
  </label>
  <p class="fennevia-customize__interaction-help">
    {t("customize.multiplePlacementsHelp")}
  </p>

  <label class="fennevia-customize__panel-toggle">
    <input
      checked={props.panels.allowCompactWindow}
      data-fennevia-customize-compact-window=""
      onchange={setAllowCompactWindow}
      type="checkbox"
    />
    <span>{t("customize.allowCompactWindow")}</span>
  </label>
  <p class="fennevia-customize__interaction-help">
    {t("customize.allowCompactWindowHelp")}
  </p>

  <label class="fennevia-customize__panel-toggle">
    <input
      checked={props.panels.leftPanelEnabled}
      data-fennevia-customize-left-panel=""
      onchange={(event) => setPanelEnabled("left", event)}
      type="checkbox"
    />
    <span>{t("customize.leftPanel")}</span>
  </label>

  <label class="fennevia-customize__panel-toggle">
    <input
      checked={props.panels.rightPanelEnabled}
      data-fennevia-customize-right-panel=""
      onchange={(event) => setPanelEnabled("right", event)}
      type="checkbox"
    />
    <span>{t("customize.rightPanel")}</span>
  </label>

  <label class="fennevia-customize__panel-toggle">
    <input
      checked={props.panels.bottomPanelEnabled}
      data-fennevia-customize-bottom-panel=""
      onchange={(event) => setPanelEnabled("bottom", event)}
      type="checkbox"
    />
    <span>{t("customize.bottomPanel")}</span>
  </label>

  <label class="fennevia-customize__panel-field">
    <span>{t("customize.topProgressLight")}</span>
    <select
      class="fennevia-control fennevia-customize__select"
      data-fennevia-customize-top-light=""
      onchange={(event) => setProgressLight("top", event)}
      value={props.panels.topProgressLight}
    >
      <option value="loading">{t("customize.progressLight.loading")}</option>
      <option value="downloads">{t("customize.progressLight.downloads")}</option
      >
      <option value="off">{t("customize.progressLight.off")}</option>
    </select>
  </label>

  <label class="fennevia-customize__panel-field">
    <span>{t("customize.bottomProgressLight")}</span>
    <select
      class="fennevia-control fennevia-customize__select"
      data-fennevia-customize-bottom-light=""
      onchange={(event) => setProgressLight("bottom", event)}
      value={props.panels.bottomProgressLight}
    >
      <option value="loading">{t("customize.progressLight.loading")}</option>
      <option value="downloads">{t("customize.progressLight.downloads")}</option
      >
      <option value="off">{t("customize.progressLight.off")}</option>
    </select>
  </label>

  <button
    class="fennevia-control fennevia-customize__reset"
    data-fennevia-customize-reset-panels=""
    disabled={!props.customized}
    onclick={props.onResetPanels}
    type="button"
  >
    {t("customize.resetPanels")}
  </button>

  <button
    class="fennevia-control fennevia-customize__reset fennevia-customize__danger"
    data-fennevia-customize-clean-layout=""
    bind:this={cleanButton}
    onclick={() => (cleanConfirmOpen = true)}
    type="button"
  >
    {t("customize.cleanPanels")}
  </button>

  {#if cleanConfirmOpen}
    <div
      aria-describedby="fennevia-clean-panels-description"
      aria-labelledby="fennevia-clean-panels-title"
      class="fennevia-customize__confirm-alert"
      data-fennevia-customize-clean-confirm=""
      onkeydown={handleCleanConfirmKeydown}
      role="alertdialog"
      tabindex="-1"
    >
      <h3 id="fennevia-clean-panels-title">
        {t("customize.cleanPanelsConfirmTitle")}
      </h3>
      <p id="fennevia-clean-panels-description">
        {t("customize.cleanPanelsConfirmDescription")}
      </p>
      <div class="fennevia-customize__confirm-actions">
        <button
          class="fennevia-control fennevia-customize__reset"
          data-fennevia-customize-clean-cancel=""
          onclick={cancelClean}
          type="button"
          use:focusOnMount
        >
          {t("customize.cleanPanelsCancel")}
        </button>
        <button
          class="fennevia-control fennevia-customize__reset fennevia-customize__danger"
          data-fennevia-customize-clean-confirm-action=""
          onclick={confirmClean}
          type="button"
        >
          {t("customize.cleanPanelsConfirm")}
        </button>
      </div>
    </div>
  {/if}
</fieldset>
