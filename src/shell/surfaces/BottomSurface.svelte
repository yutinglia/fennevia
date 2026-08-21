<!-- SPDX-License-Identifier: MPL-2.0 -->
<script lang="ts">
  import type { BrowserToolsStateAdapter } from "../../app/browser-tools-state";
  import type { CustomizeSessionController } from "../../app/customize-session";
  import type { BrowserDownloadsStateAdapter } from "../../app/download-state";
  import type { EdgeShellController } from "../../app/edge-surfaces";
  import type { FenneviaLocale } from "../../app/locale-state";
  import type {
    BrowserToolbarWidgetsState,
    BrowserToolbarWidgetsStateAdapter,
  } from "../../app/toolbar-widgets-state";
  import DownloadsPanel from "../DownloadsPanel.svelte";
  import ToolbarWidgetZone from "../features/toolbar-widgets/ToolbarWidgetZone.svelte";

  type Props = Readonly<{
    browserTools?: BrowserToolsStateAdapter;
    customizeOpen: boolean;
    customizeSession?: CustomizeSessionController;
    downloads: BrowserDownloadsStateAdapter;
    localeId: FenneviaLocale;
    onDismiss: () => void;
    onFatalError: (error: unknown) => void;
    shell: EdgeShellController;
    toolbarWidgets?: BrowserToolbarWidgetsStateAdapter;
    toolbarWidgetsState: BrowserToolbarWidgetsState | null;
  }>;

  const props: Props = $props();
</script>

<DownloadsPanel
  downloads={props.downloads}
  localeId={props.localeId}
  onFatalError={props.onFatalError}
/>

<ToolbarWidgetZone
  browserTools={props.browserTools}
  customizeOpen={props.customizeOpen}
  customizeSession={props.customizeSession}
  edge="bottom"
  localeId={props.localeId}
  onDismiss={() => props.onDismiss()}
  onFatalError={props.onFatalError}
  shell={props.shell}
  state={props.toolbarWidgetsState}
  toolbarWidgets={props.toolbarWidgets}
/>
