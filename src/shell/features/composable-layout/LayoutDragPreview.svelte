<!-- SPDX-License-Identifier: MPL-2.0 -->
<script lang="ts">
  import { resolveToolbarWidgetDragPreviewSize } from "../../../app/toolbar-widget-drag";
  import type { ToolbarLayoutDirection } from "../../../app/toolbar-widgets-state";
  import ShellIcon from "../../ShellIcon.svelte";
  import ToolbarWidgetGlyph from "../../ToolbarWidgetGlyph.svelte";
  import type { LayoutDragPreviewDescriptor } from "./layout-drag-preview";

  type Props = Readonly<{
    descriptor: LayoutDragPreviewDescriptor;
    direction: ToolbarLayoutDirection;
  }>;

  const { descriptor, direction }: Props = $props();
  const size = $derived(
    resolveToolbarWidgetDragPreviewSize(descriptor.kind, direction),
  );
</script>

<div
  aria-hidden="true"
  class="fennevia-layout-drop-preview"
  data-fennevia-layout-drop-preview={descriptor.kind}
  style:--fennevia-drag-preview-block={`${size.blockSize}px`}
  style:--fennevia-drag-preview-inline={`${size.inlineSize}px`}
>
  <span class="fennevia-layout-drop-preview__icon">
    {#if descriptor.structureIcon}
      <ShellIcon name={descriptor.structureIcon} />
    {:else if descriptor.glyph}
      <ToolbarWidgetGlyph widget={descriptor.glyph} />
    {:else}
      <span class="fennevia-layout-drop-preview__space">·</span>
    {/if}
  </span>
  <span class="fennevia-layout-drop-preview__label">{descriptor.label}</span>
</div>
