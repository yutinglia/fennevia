<!-- SPDX-License-Identifier: MPL-2.0 -->
<script lang="ts">
  import type { FenneviaLocale } from "../../../app/locale-state";
  import type { ToolbarLayoutNodeSnapshot } from "../../../app/toolbar-widgets-state";
  import type { BrowserWindowControlsStateAdapter } from "../../../app/window-controls-state";
  import { collectWindowControls } from "./window-control-layout";
  import WindowControlWidget from "./WindowControlWidget.svelte";

  const props: Readonly<{
    nodes: readonly ToolbarLayoutNodeSnapshot[];
    localeId: FenneviaLocale;
    windowControls: BrowserWindowControlsStateAdapter;
    onFatalError: (error: unknown) => void;
  }> = $props();
  let controls = $derived(collectWindowControls(props.nodes));
</script>

{#if controls.length > 0}
  <div
    class="fennevia-window-controls-dock"
    data-fennevia-window-controls-dock=""
  >
    {#each controls as node (node.instanceId)}
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
