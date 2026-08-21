<script lang="ts">
  export type ShellIconName =
    | "account"
    | "address"
    | "back"
    | "bookmark"
    | "close"
    | "customize"
    | "developer"
    | "download"
    | "edit"
    | "extensions"
    | "firefox-view"
    | "forward"
    | "fullscreen"
    | "generic"
    | "history"
    | "home"
    | "library"
    | "lock"
    | "maximize"
    | "menu"
    | "minimize"
    | "new-window"
    | "palette"
    | "permissions"
    | "plus"
    | "print"
    | "private"
    | "reload"
    | "restore"
    | "screenshot"
    | "settings"
    | "shield"
    | "sidebar"
    | "stop"
    | "toolbar"
    | "translate"
    | "zoom";

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
  {:else if name === "home"}
    <path d="M4 11.5 12 4l8 7.5" />
    <path d="M6.5 10.8V20h11V10.8" />
    <path d="M10 20v-5.5h4V20" />
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
  {:else if name === "account"}
    <circle cx="12" cy="8.5" r="3.5" />
    <path d="M5 20a7 7 0 0 1 14 0" />
  {:else if name === "developer"}
    <path d="m9 8-4 4 4 4M15 8l4 4-4 4" />
  {:else if name === "edit"}
    <path d="m14.5 5 4.5 4.5L9 19.5H4.5V15Z" />
    <path d="m12.5 7 4.5 4.5" />
  {:else if name === "firefox-view"}
    <rect height="14" rx="3" width="18" x="3" y="5" />
    <circle cx="12" cy="12" r="3" />
  {:else if name === "fullscreen"}
    <path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5" />
  {:else if name === "generic"}
    <rect height="14" rx="3" width="14" x="5" y="5" />
    <circle cx="12" cy="12" r="1.5" fill="currentColor" />
  {:else if name === "history"}
    <circle cx="12" cy="12" r="8" />
    <path d="M12 7v5l3.5 2" />
  {:else if name === "library"}
    <path d="M5 4v16M9.5 4v16M14 5l4.5 15" />
  {:else if name === "new-window"}
    <rect height="14" rx="2" width="14" x="4" y="6" />
    <path d="M11 13h4M13 11v4M20 10V4h-6" />
  {:else if name === "palette"}
    <path d="M12 3a9 9 0 1 0 0 18h1.5a2.5 2.5 0 0 0 0-5H12a2 2 0 0 1 0-4h9" />
    <circle cx="7.5" cy="11" r="1.2" fill="currentColor" />
    <circle cx="10.5" cy="7" r="1.2" fill="currentColor" />
    <circle cx="15.5" cy="7" r="1.2" fill="currentColor" />
  {:else if name === "print"}
    <path d="M7 8V4h10v4" />
    <rect height="8" rx="2" width="16" x="4" y="8" />
    <path d="M7 13h10v7H7Z" />
  {:else if name === "private"}
    <path d="M4 11h16M7 11l1.5-6h7L17 11" />
    <circle cx="8.5" cy="16" r="2.5" />
    <circle cx="15.5" cy="16" r="2.5" />
    <path d="M11 15.5h2" />
  {:else if name === "screenshot"}
    <path d="M4 8V4h4M16 4h4v4M20 16v4h-4M8 20H4v-4" />
    <circle cx="12" cy="12" r="3" />
  {:else if name === "sidebar"}
    <rect height="16" rx="3" width="18" x="3" y="4" />
    <path d="M9.5 4v16" />
  {:else if name === "translate"}
    <path d="M4 5h8M8 3v2M5.5 8.5c2.4 3 5.4 4.8 8.5 5.5" />
    <path d="M11 5c-.8 3.3-3.2 6.2-6.5 8M13 20l3.5-9 3.5 9M14.2 17h5.6" />
  {:else if name === "zoom"}
    <circle cx="11" cy="11" r="6" />
    <path d="m15.5 15.5 4 4M9 11h4M11 9v4" />
  {/if}
</svg>
