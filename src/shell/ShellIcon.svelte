<!-- SPDX-License-Identifier: MPL-2.0 -->
<script lang="ts">
  export type ShellIconName =
    | "close"
    | "generic"
    | "maximize"
    | "minimize"
    | "restore"
    | "shield"
    | "zoom";

  type Props = Readonly<{
    name: ShellIconName;
  }>;

  const { name }: Props = $props();
</script>

<svg
  aria-hidden="true"
  class="fennevia-icon"
  data-fennevia-icon={name}
  fill="none"
  focusable="false"
  height="16"
  viewBox="0 0 24 24"
  width="16"
>
  {#if name === "close"}
    <path d="m7 7 10 10M17 7 7 17" />
  {:else if name === "maximize"}
    <rect height="14" rx="1.5" width="14" x="5" y="5" />
  {:else if name === "minimize"}
    <path d="M5 19h14" />
  {:else if name === "restore"}
    <rect height="10" rx="1.2" width="10" x="9" y="5" />
    <path d="M5 9h8v10H5Z" />
  {:else if name === "shield"}
    <path d="M12 3 19 6v5c0 4.6-2.8 8-7 10-4.2-2-7-5.4-7-10V6Z" />
    <path d="m9 12 2 2 4-4" />
  {:else if name === "zoom"}
    <circle cx="11" cy="11" r="6" />
    <path d="m15.5 15.5 4 4M9 11h4M11 9v4" />
  {:else}
    <rect height="14" rx="3" width="14" x="5" y="5" />
    <circle cx="12" cy="12" r="1.5" fill="currentColor" />
  {/if}
</svg>
