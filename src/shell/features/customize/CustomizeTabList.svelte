<!-- SPDX-License-Identifier: MPL-2.0 -->
<script module lang="ts">
  export const customizeTabIds = [
    "widgets",
    "panels",
    "interaction",
    "appearance",
  ] as const;

  export type CustomizeTabId = (typeof customizeTabIds)[number];
</script>

<script lang="ts">
  import { tick } from "svelte";

  import { translate, type MessageKey } from "../../../app/i18n";
  import type { FenneviaLocale } from "../../../app/locale-state";

  type Props = Readonly<{
    localeId: FenneviaLocale;
    onSelect: (tab: CustomizeTabId) => void;
    selected: CustomizeTabId;
  }>;

  const props: Props = $props();
  const t = (key: MessageKey): string => translate(props.localeId, key);
  const tabLabel = (tab: CustomizeTabId): string =>
    t(("customize.tab." + tab) as MessageKey);

  let tablistElement: HTMLDivElement | undefined = $state();

  const focusSelectedTab = async (tab: CustomizeTabId): Promise<void> => {
    await tick();
    tablistElement
      ?.querySelector<HTMLButtonElement>(
        `[data-fennevia-customize-tab="${tab}"]`,
      )
      ?.focus();
  };

  const selectTab = (tab: CustomizeTabId): void => {
    props.onSelect(tab);
    void focusSelectedTab(tab);
  };

  const selectByOffset = (offset: number): void => {
    const index = customizeTabIds.indexOf(props.selected);
    const next =
      customizeTabIds[
        (index + offset + customizeTabIds.length) % customizeTabIds.length
      ];
    if (next) {
      selectTab(next);
    }
  };

  const handleKeydown = (event: KeyboardEvent): void => {
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      event.preventDefault();
      selectByOffset(1);
      return;
    }
    if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      event.preventDefault();
      selectByOffset(-1);
      return;
    }
    if (event.key === "Home") {
      event.preventDefault();
      selectTab(customizeTabIds[0]);
      return;
    }
    if (event.key === "End") {
      event.preventDefault();
      selectTab(customizeTabIds[customizeTabIds.length - 1]);
    }
  };
</script>

<div
  bind:this={tablistElement}
  aria-label={t("customize.tabsAria")}
  class="fennevia-customize__tabs"
  data-fennevia-customize-tabs=""
  onkeydown={handleKeydown}
  role="tablist"
  tabindex="-1"
>
  {#each customizeTabIds as tab (tab)}
    <button
      aria-controls={`fennevia-customize-tabpanel-${tab}`}
      aria-selected={props.selected === tab}
      class="fennevia-control fennevia-customize__tab"
      data-fennevia-customize-tab={tab}
      id={`fennevia-customize-tab-${tab}`}
      onclick={() => selectTab(tab)}
      role="tab"
      tabindex={props.selected === tab ? 0 : -1}
      type="button">{tabLabel(tab)}</button
    >
  {/each}
</div>
