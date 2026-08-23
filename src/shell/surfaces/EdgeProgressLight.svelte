<!-- SPDX-License-Identifier: MPL-2.0 -->
<script lang="ts">
  import type {
    BrowserDownloadsState,
    BrowserDownloadsStateAdapter,
  } from "../../app/download-state";
  import type { EdgeName } from "../../app/edge-surfaces";
  import type { ProgressLightSource } from "../../app/toolbar-widgets-state";
  import {
    createBrowserNavigationState,
    type BrowserNavigationState,
    type BrowserNavigationStateAdapter,
  } from "../../app/navigation-state";
  import {
    resolveDownloadProgressLight,
    resolveLoadProgressLight,
  } from "../../app/progress-light";
  import ProgressLight from "../ProgressLight.svelte";

  type Props = Readonly<{
    downloads?: BrowserDownloadsStateAdapter;
    edge: EdgeName;
    navigation?: BrowserNavigationStateAdapter;
    source: ProgressLightSource;
  }>;

  const props: Props = $props();
  let currentNavigation: BrowserNavigationState = $state(
    createBrowserNavigationState({
      addressValue: "",
      canGoBack: false,
      canGoForward: false,
      connectionSecurity: "unavailable",
      displayUri: "",
      loading: false,
      title: "",
      trackingProtection: "unavailable",
    }),
  );
  let currentDownloads: BrowserDownloadsState | null = $state(null);

  $effect(() => {
    if (props.source !== "loading" || !props.navigation) {
      return;
    }
    currentNavigation = props.navigation.snapshot();
    return props.navigation.subscribe((nextState) => {
      currentNavigation = nextState;
    });
  });

  $effect(() => {
    if (props.source !== "downloads" || !props.downloads) {
      currentDownloads = null;
      return;
    }
    currentDownloads = props.downloads.snapshot();
    return props.downloads.subscribe((nextState) => {
      currentDownloads = nextState;
    });
  });

  let presentation = $derived(
    props.source === "loading"
      ? resolveLoadProgressLight(currentNavigation.snapshot.loading)
      : props.source === "downloads"
        ? resolveDownloadProgressLight(currentDownloads)
        : null,
  );
</script>

{#if (props.edge === "top" || props.edge === "bottom") && presentation}
  <ProgressLight {presentation} />
{/if}
