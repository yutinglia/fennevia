<script lang="ts">
  export type ShellIconName =
    | "address"
    | "back"
    | "bookmark"
    | "close"
    | "customize"
    | "download"
    | "extensions"
    | "forward"
    | "lock"
    | "maximize"
    | "menu"
    | "minimize"
    | "permissions"
    | "plus"
    | "reload"
    | "restore"
    | "settings"
    | "shield"
    | "stop"
    | "toolbar";

  type Props = Readonly<{
    name: ShellIconName;
    size?: number;
  }>;

  const { name, size = 16 }: Props = $props();
</script>

<svg
  aria-hidden="true"
  class="fennevia-icon"
  data-fennevia-icon={name}
  fill="none"
  focusable="false"
  height={size}
  viewBox="0 0 24 24"
  width={size}
>
  {#if name === "back"}
    <path d="m14.5 5-7 7 7 7" />
    <path d="M8 12h11" />
  {:else if name === "forward"}
    <path d="m9.5 5 7 7-7 7" />
    <path d="M16 12H5" />
  {:else if name === "reload"}
    <path d="M19 8a8 8 0 1 0 1 6" />
    <path d="M19 3v5h-5" />
  {:else if name === "stop"}
    <rect fill="currentColor" height="10" rx="2" width="10" x="7" y="7" />
  {:else if name === "plus"}
    <path d="M12 5v14M5 12h14" />
  {:else if name === "address"}
    <circle cx="10.5" cy="10.5" r="5.5" />
    <path d="m15 15 4 4" />
  {:else if name === "extensions"}
    <path
      d="M4 4h6v3a2 2 0 1 0 4 0V4h6v6h-3a2 2 0 1 0 0 4h3v6h-6v-3a2 2 0 1 0-4 0v3H4v-6h3a2 2 0 1 0 0-4H4Z"
    />
  {:else if name === "settings"}
    <circle cx="12" cy="12" r="3.5" />
    <path
      d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1"
    />
  {:else if name === "customize"}
    <path d="M4 7h7M15 7h5M4 17h3M11 17h9" />
    <circle cx="13" cy="7" r="2" />
    <circle cx="9" cy="17" r="2" />
  {:else if name === "toolbar"}
    <rect height="16" rx="3" width="18" x="3" y="4" />
    <path d="M3 9h18M7 6.5h.01M10 6.5h.01" />
  {:else if name === "menu"}
    <path d="M5 7h14M5 12h14M5 17h14" />
  {:else if name === "bookmark"}
    <path d="M7 4h10v16l-5-3-5 3Z" />
  {:else if name === "download"}
    <path d="M12 4v10M8 10l4 4 4-4M5 19h14" />
  {:else if name === "lock"}
    <rect height="10" rx="2" width="14" x="5" y="10" />
    <path d="M8 10V7a4 4 0 0 1 8 0v3" />
    <path d="M12 14v2" />
  {:else if name === "shield"}
    <path d="M12 3 19 6v5c0 4.6-2.8 8-7 10-4.2-2-7-5.4-7-10V6Z" />
    <path d="m9 12 2 2 4-4" />
  {:else if name === "permissions"}
    <circle cx="8" cy="12" r="3" />
    <path d="M11 12h9M16 12v3M19 12v2" />
  {:else if name === "close"}
    <path d="m7 7 10 10M17 7 7 17" />
  {:else if name === "minimize"}
    <path d="M5 19h14" />
  {:else if name === "maximize"}
    <rect height="14" rx="1.5" width="14" x="5" y="5" />
  {:else if name === "restore"}
    <rect height="10" rx="1.2" width="10" x="9" y="5" />
    <path d="M5 9h8v10H5Z" />
  {/if}
</svg>
