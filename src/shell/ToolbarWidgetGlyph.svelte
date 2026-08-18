<script lang="ts">
  import type {
    ToolbarPaletteEntrySnapshot,
    ToolbarWidgetSnapshot,
  } from "../app/toolbar-widgets-state";
  import ShellIcon from "./ShellIcon.svelte";
  import { resolveToolbarWidgetIcon } from "./toolbar-widget-icons";

  type Props = Readonly<{
    widget: ToolbarPaletteEntrySnapshot | ToolbarWidgetSnapshot;
  }>;

  const { widget }: Props = $props();

  const extensionImageUrl = $derived(
    widget.kind === "extension-action" &&
      widget.iconUrl.startsWith("moz-extension://")
      ? widget.iconUrl
      : "",
  );
  const nativeMaskUrl = $derived(
    extensionImageUrl === "" &&
      (widget.iconUrl.startsWith("chrome://") ||
        widget.iconUrl.startsWith("resource://"))
      ? widget.iconUrl
      : "",
  );
  const nativeMaskImage = $derived(
    nativeMaskUrl === "" ? "" : `url("${nativeMaskUrl}")`,
  );
</script>

{#if extensionImageUrl}
  <img alt="" class="fennevia-toolbar-widgets__icon" src={extensionImageUrl} />
{:else if nativeMaskImage}
  <span
    aria-hidden="true"
    class="fennevia-toolbar-widgets__native-icon"
    style:mask-image={nativeMaskImage}
    style:-webkit-mask-image={nativeMaskImage}
  ></span>
{:else}
  <ShellIcon name={resolveToolbarWidgetIcon(widget)} />
{/if}
