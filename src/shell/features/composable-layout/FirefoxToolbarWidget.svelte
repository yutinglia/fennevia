<!-- SPDX-License-Identifier: MPL-2.0 -->
<script lang="ts">
  import type {
    EdgeName,
    EdgeShellController,
  } from "../../../app/edge-surfaces";
  import type { FenneviaLocale } from "../../../app/locale-state";
  import {
    isInteractiveToolbarWidget,
    type BrowserToolbarWidgetsStateAdapter,
    type ToolbarWidgetPartSnapshot,
    type ToolbarWidgetSnapshot,
  } from "../../../app/toolbar-widgets-state";
  import { resolveBrowserToolHost } from "../../browser-tool-host";
  import { localizeWidgetLabel, localizeWidgetTooltip } from "../../locale-ui";
  import ToolbarWidgetGlyph from "../../ToolbarWidgetGlyph.svelte";

  type Props = Readonly<{
    customizeOpen: boolean;
    edge: EdgeName;
    localeId: FenneviaLocale;
    shell: EdgeShellController;
    toolbarWidgets?: BrowserToolbarWidgetsStateAdapter;
    widget: ToolbarWidgetSnapshot;
  }>;

  const props: Props = $props();
  let label = $derived(localizeWidgetLabel(props.localeId, props.widget));

  const invoke = async (handle: string, event: MouseEvent): Promise<void> => {
    if (props.customizeOpen || !props.toolbarWidgets || handle === "") {
      return;
    }
    props.shell.setPopupHeld(props.edge, true);
    try {
      const opened = await props.toolbarWidgets.invoke(
        handle,
        resolveBrowserToolHost(event),
        event,
      );
      if (!opened) {
        props.shell.setPopupHeld(props.edge, false);
      }
    } catch {
      props.shell.setPopupHeld(props.edge, false);
    }
  };

  const partLabel = (part: ToolbarWidgetPartSnapshot): string => {
    const tooltip = localizeWidgetTooltip(
      props.localeId,
      part.tooltip,
      part.label,
    );
    return part.valueText === "" || tooltip === part.valueText
      ? part.label
      : `${part.valueText}, ${tooltip}`;
  };
</script>

{#if props.widget.kind === "separator" || props.widget.kind === "spacer" || props.widget.kind === "spring"}
  <span
    aria-hidden="true"
    class={`fennevia-toolbar-widgets__item fennevia-toolbar-widgets__${props.widget.kind}`}
    data-fennevia-layout-special={props.widget.kind}
    data-fennevia-window-drag-region=""
  ></span>
{:else if props.widget.parts.length > 0}
  <div
    aria-label={label}
    class="fennevia-toolbar-widgets__compound fennevia-toolbar-widgets__item"
    data-fennevia-toolbar-widget-item=""
    role="group"
  >
    {#each props.widget.parts as part (part.handle)}
      <button
        aria-label={partLabel(part)}
        class="fennevia-control fennevia-toolbar-widgets__button fennevia-toolbar-widgets__compound-button"
        data-fennevia-browser-tool="toolbar-widget-part"
        disabled={props.customizeOpen || part.disabled}
        onclick={(event) => void invoke(part.handle, event)}
        tabindex={props.customizeOpen ? -1 : undefined}
        title={localizeWidgetTooltip(props.localeId, part.tooltip, part.label)}
        type="button"
      >
        {#if part.valueText}
          <span
            aria-hidden="true"
            class="fennevia-toolbar-widgets__compound-value"
            >{part.valueText}</span
          >
        {:else}
          <ToolbarWidgetGlyph widget={part} />
        {/if}
      </button>
    {/each}
  </div>
{:else}
  <button
    aria-label={label}
    class="fennevia-control fennevia-toolbar-widgets__button fennevia-toolbar-widgets__item"
    data-fennevia-browser-tool="toolbar-widget"
    data-fennevia-toolbar-widget-kind={props.widget.kind}
    disabled={props.customizeOpen ||
      props.widget.disabled ||
      !isInteractiveToolbarWidget(props.widget)}
    onclick={(event) => void invoke(props.widget.handle, event)}
    tabindex={props.customizeOpen ? -1 : undefined}
    title={localizeWidgetTooltip(props.localeId, props.widget.tooltip, label)}
    type="button"
  >
    <ToolbarWidgetGlyph widget={props.widget} />
    {#if props.widget.badgeText}
      <span
        aria-hidden="true"
        class="fennevia-toolbar-widgets__badge"
        style:background-color={props.widget.badgeBackground || undefined}
        style:color={props.widget.badgeTextColor || undefined}
        >{props.widget.badgeText}</span
      >
    {/if}
  </button>
{/if}
