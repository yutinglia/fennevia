<!-- SPDX-License-Identifier: MPL-2.0 -->
<script lang="ts">
  import {
    isProgressLightSource,
    isSidePanelLayout,
    type ProgressLightSource,
    type ShellPanelConfigSnapshot,
    type SidePanelLayout,
  } from "../../../app/toolbar-widgets-state";
  import { translate, type MessageKey } from "../../../app/i18n";
  import type { FenneviaLocale } from "../../../app/locale-state";

  type Props = Readonly<{
    customized: boolean;
    localeId: FenneviaLocale;
    onResetPanels: () => void;
    onSetPanels: (
      panels: Readonly<Partial<ShellPanelConfigSnapshot>>,
    ) => void;
    panels: ShellPanelConfigSnapshot;
  }>;

  const props: Props = $props();
  const t = (key: MessageKey): string => translate(props.localeId, key);

  const setSidePanelLayout = (event: Event): void => {
    const value =
      event.currentTarget instanceof HTMLSelectElement
        ? event.currentTarget.value
        : "";
    if (isSidePanelLayout(value)) {
      props.onSetPanels({ sidePanelLayout: value as SidePanelLayout });
    }
  };

  const setProgressLight = (
    edge: "bottom" | "top",
    event: Event,
  ): void => {
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

  const setBottomPanelEnabled = (event: Event): void => {
    const checked =
      event.currentTarget instanceof HTMLInputElement
        ? event.currentTarget.checked
        : false;
    props.onSetPanels({ bottomDownloadsEnabled: checked });
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
    <span>{t("customize.sidePanels")}</span>
    <select
      class="fennevia-control fennevia-customize__select"
      data-fennevia-customize-side-layout=""
      onchange={setSidePanelLayout}
      value={props.panels.sidePanelLayout}
    >
      <option value="tabs-left">{t("customize.sidePanels.tabsLeft")}</option>
      <option value="tabs-right">{t("customize.sidePanels.tabsRight")}</option>
    </select>
  </label>

  <label class="fennevia-customize__panel-toggle">
    <input
      checked={props.panels.bottomDownloadsEnabled}
      data-fennevia-customize-bottom-panel=""
      onchange={setBottomPanelEnabled}
      type="checkbox"
    />
    <span>{t("customize.bottomDownloadsPanel")}</span>
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
      <option value="downloads">{t("customize.progressLight.downloads")}</option>
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
      <option value="downloads">{t("customize.progressLight.downloads")}</option>
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
</fieldset>
