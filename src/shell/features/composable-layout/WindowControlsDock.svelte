<!-- SPDX-License-Identifier: MPL-2.0 -->
<script lang="ts">
  import type { FenneviaLocale } from "../../../app/locale-state";
  import type { BrowserWindowControlsStateAdapter } from "../../../app/window-controls-state";
  import type { WindowControlNode } from "./window-control-layout";
  import type { ToolbarLayoutDirection } from "../../../app/toolbar-widgets-state";
  import WindowControlWidget from "./WindowControlWidget.svelte";

  const props: Readonly<{
    direction: ToolbarLayoutDirection;
    nodes: readonly WindowControlNode[];
    localeId: FenneviaLocale;
    windowControls: BrowserWindowControlsStateAdapter;
    onFatalError: (error: unknown) => void;
  }> = $props();
</script>

{#if props.nodes.length > 0}
  <div
    class="fennevia-window-controls-dock"
    class:fennevia-window-controls-dock--column={props.direction === "column"}
    data-fennevia-window-controls-dock=""
  >
    {#each props.nodes as node (node.instanceId)}
      <div
        class="fennevia-layout-node"
        data-fennevia-layout-instance={node.instanceId}
        data-fennevia-layout-node=""
        data-fennevia-layout-node-type="item"
      >
        <div
          class="fennevia-layout-node__content"
          data-fennevia-layout-node-content=""
        >
          <WindowControlWidget
            customizeOpen={false}
            id={node.projectId}
            localeId={props.localeId}
            onFatalError={props.onFatalError}
            windowControls={props.windowControls}
          />
        </div>
      </div>
    {/each}
  </div>
{/if}
