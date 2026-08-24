<!-- SPDX-License-Identifier: MPL-2.0 -->
<script lang="ts">
  import type { EdgeShellController } from "../../../app/edge-surfaces";
  import { translate } from "../../../app/i18n";
  import type { FenneviaLocale } from "../../../app/locale-state";
  import type { ProjectWidgetId } from "../../../app/toolbar-widgets-state";
  import FirefoxIcon from "../../FirefoxIcon.svelte";

  type ShellProjectId = Extract<
    ProjectWidgetId,
    "customize-shell" | "private-indicator"
  >;

  type Props = Readonly<{
    canEdit: boolean;
    customizeOpen: boolean;
    id: ShellProjectId;
    localeId: FenneviaLocale;
    onSetCustomizeOpen: (open: boolean) => void;
    shell: EdgeShellController;
    windowKind: "normal" | "private";
  }>;

  const props: Props = $props();

  const openCustomize = (): void => {
    if (!props.canEdit) {
      return;
    }
    props.shell.revealProgrammatically("top");
    props.onSetCustomizeOpen(!props.customizeOpen);
  };
</script>

{#if props.id === "customize-shell"}
  <button
    aria-expanded={props.customizeOpen}
    aria-label={translate(props.localeId, "nav.customizeAria")}
    class="fennevia-control fennevia-browser-tools__button fennevia-layout-control"
    data-fennevia-action="customize-shell"
    disabled={!props.canEdit}
    onclick={openCustomize}
    tabindex={props.customizeOpen ? -1 : undefined}
    title={translate(props.localeId, "nav.customizeTitle")}
    type="button"
  >
    <FirefoxIcon name="customize" />
  </button>
{:else if props.windowKind === "private" || props.customizeOpen}
  <span
    aria-label={translate(props.localeId, "nav.private")}
    class="fennevia-navigation__private fennevia-layout-private"
    data-fennevia-private-indicator=""
  >
    <FirefoxIcon name="private" />
    <span>{translate(props.localeId, "nav.private")}</span>
  </span>
{/if}
