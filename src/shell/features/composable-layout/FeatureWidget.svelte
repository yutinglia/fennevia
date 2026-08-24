<!-- SPDX-License-Identifier: MPL-2.0 -->
<script lang="ts">
  import type { BrowserBookmarksStateAdapter } from "../../../app/bookmark-state";
  import type { BrowserDownloadsStateAdapter } from "../../../app/download-state";
  import type {
    EdgeName,
    EdgeShellController,
  } from "../../../app/edge-surfaces";
  import type { FenneviaLocale } from "../../../app/locale-state";
  import type { BrowserTabsStateAdapter } from "../../../app/tab-state";
  import type {
    ProjectWidgetId,
    ProjectWidgetStyleId,
    ToolbarLayoutDirection,
  } from "../../../app/toolbar-widgets-state";
  import BookmarksPanel from "../../BookmarksPanel.svelte";
  import DownloadsPanel from "../../DownloadsPanel.svelte";
  import TabStrip from "../tabs/TabStrip.svelte";

  type FeatureProjectId = Extract<
    ProjectWidgetId,
    "bookmarks" | "downloads-status" | "tabs"
  >;

  type Props = Readonly<{
    bookmarks: BrowserBookmarksStateAdapter;
    direction: ToolbarLayoutDirection;
    downloads: BrowserDownloadsStateAdapter;
    edge: EdgeName;
    id: FeatureProjectId;
    localeId: FenneviaLocale;
    onDismiss: (edge: EdgeName) => void;
    onFatalError: (error: unknown) => void;
    shell: EdgeShellController;
    tabs: BrowserTabsStateAdapter;
    widgetStyle: ProjectWidgetStyleId | "";
  }>;

  const props: Props = $props();
</script>

{#if props.id === "tabs"}
  <TabStrip
    edge={props.edge}
    localeId={props.localeId}
    onFatalError={props.onFatalError}
    orientation={props.direction}
    shell={props.shell}
    showNewTab={props.widgetStyle === "with-new-tab"}
    tabs={props.tabs}
  />
{:else if props.id === "bookmarks"}
  <BookmarksPanel
    bookmarks={props.bookmarks}
    edge={props.edge}
    localeId={props.localeId}
    onDismiss={() => props.onDismiss(props.edge)}
    onFatalError={props.onFatalError}
    orientation={props.direction}
    shell={props.shell}
  />
{:else}
  <DownloadsPanel
    downloads={props.downloads}
    localeId={props.localeId}
    onFatalError={props.onFatalError}
    orientation={props.direction}
  />
{/if}
