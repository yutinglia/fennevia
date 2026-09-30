<!-- SPDX-License-Identifier: MPL-2.0 -->
<script lang="ts">
  import type { BrowserDownloadsState } from "../../../app/download-state";
  import FirefoxIcon from "../../FirefoxIcon.svelte";

  const props: Readonly<{
    mode: BrowserDownloadsState["progressMode"];
    percent: number | null;
  }> = $props();
</script>

{#if props.mode === "none"}
  <FirefoxIcon name="download" />
{:else}
  <svg
    aria-hidden="true"
    class="fennevia-download-indicator"
    data-fennevia-download-indicator={props.mode}
    focusable="false"
    viewBox="0 0 20 20"
  >
    <circle class="fennevia-download-indicator__track" cx="10" cy="10" r="7" />
    <circle
      class="fennevia-download-indicator__progress"
      cx="10"
      cy="10"
      r="7"
      pathLength="100"
      stroke-dasharray={props.mode === "determinate"
        ? `${props.percent ?? 0} 100`
        : "16 9"}
      transform="rotate(-90 10 10)"
    />
  </svg>
{/if}
