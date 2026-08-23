<!-- SPDX-License-Identifier: MPL-2.0 -->
<script lang="ts">
  import type { BrowserBookmarksStateAdapter } from "../../app/bookmark-state";
  import type { BrowserToolsStateAdapter } from "../../app/browser-tools-state";
  import type { CustomizeSessionController } from "../../app/customize-session";
  import type { EdgeShellController } from "../../app/edge-surfaces";
  import type { FenneviaLocale } from "../../app/locale-state";
  import type {
    BrowserToolbarWidgetsState,
    BrowserToolbarWidgetsStateAdapter,
    SidePanelEdge,
  } from "../../app/toolbar-widgets-state";
  import BookmarksPanel from "../BookmarksPanel.svelte";
  import ToolbarWidgetZone from "../features/toolbar-widgets/ToolbarWidgetZone.svelte";

  type Props = Readonly<{
    bookmarks: BrowserBookmarksStateAdapter;
    browserTools?: BrowserToolsStateAdapter;
    customizeOpen: boolean;
    customizeSession?: CustomizeSessionController;
    edge: SidePanelEdge;
    localeId: FenneviaLocale;
    onDismiss: () => void;
    onFatalError: (error: unknown) => void;
    shell: EdgeShellController;
    toolbarWidgets?: BrowserToolbarWidgetsStateAdapter;
    toolbarWidgetsState: BrowserToolbarWidgetsState | null;
  }>;

  const props: Props = $props();
</script>

<BookmarksPanel
  bookmarks={props.bookmarks}
  edge={props.edge}
  localeId={props.localeId}
  onDismiss={props.onDismiss}
  onFatalError={props.onFatalError}
  shell={props.shell}
/>

<ToolbarWidgetZone
  browserTools={props.browserTools}
  customizeOpen={props.customizeOpen}
  customizeSession={props.customizeSession}
  edge={props.edge}
  localeId={props.localeId}
  onDismiss={() => props.onDismiss()}
  onFatalError={props.onFatalError}
  shell={props.shell}
  state={props.toolbarWidgetsState}
  toolbarWidgets={props.toolbarWidgets}
/>
