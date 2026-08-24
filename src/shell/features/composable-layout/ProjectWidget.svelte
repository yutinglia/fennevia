<!-- SPDX-License-Identifier: MPL-2.0 -->
<script lang="ts">
  import type { AddressPopupController } from "../../../app/address-popup";
  import type { BrowserBookmarksStateAdapter } from "../../../app/bookmark-state";
  import type { BrowserToolsStateAdapter } from "../../../app/browser-tools-state";
  import type { BrowserDownloadsStateAdapter } from "../../../app/download-state";
  import type {
    EdgeName,
    EdgeShellController,
  } from "../../../app/edge-surfaces";
  import type { FenneviaLocale } from "../../../app/locale-state";
  import type { BrowserNavigationStateAdapter } from "../../../app/navigation-state";
  import type { BrowserTabsStateAdapter } from "../../../app/tab-state";
  import type {
    ProjectWidgetId,
    ToolbarLayoutDirection,
  } from "../../../app/toolbar-widgets-state";
  import type { BrowserWindowControlsStateAdapter } from "../../../app/window-controls-state";
  import AddressLauncherWidget from "./AddressLauncherWidget.svelte";
  import BrowserToolWidget from "./BrowserToolWidget.svelte";
  import FeatureWidget from "./FeatureWidget.svelte";
  import NavigationControlWidget from "./NavigationControlWidget.svelte";
  import ShellWidget from "./ShellWidget.svelte";
  import TrustWidget from "./TrustWidget.svelte";
  import WindowControlWidget from "./WindowControlWidget.svelte";

  type Props = Readonly<{
    addressPopup: AddressPopupController;
    bookmarks: BrowserBookmarksStateAdapter;
    browserTools?: BrowserToolsStateAdapter;
    canEdit: boolean;
    customizeOpen: boolean;
    direction: ToolbarLayoutDirection;
    downloads: BrowserDownloadsStateAdapter;
    edge: EdgeName;
    id: ProjectWidgetId;
    localeId: FenneviaLocale;
    navigation: BrowserNavigationStateAdapter;
    onDismiss: (edge: EdgeName) => void;
    onFatalError: (error: unknown) => void;
    onOpenAddress: () => boolean;
    onRevealProject: (id: ProjectWidgetId) => boolean;
    onSetCustomizeOpen: (open: boolean) => void;
    shell: EdgeShellController;
    tabs: BrowserTabsStateAdapter;
    windowControls: BrowserWindowControlsStateAdapter;
    windowKind: "normal" | "private";
  }>;

  const props: Props = $props();
</script>

{#if props.id === "back" || props.id === "forward" || props.id === "home" || props.id === "new-tab" || props.id === "reload-stop"}
  <NavigationControlWidget
    customizeOpen={props.customizeOpen}
    id={props.id}
    localeId={props.localeId}
    navigation={props.navigation}
    onFatalError={props.onFatalError}
    tabs={props.tabs}
  />
{:else if props.id === "address-launcher"}
  <section
    aria-label="Address launcher"
    class="fennevia-layout-address"
    data-fennevia-address-launcher-region=""
  >
    <AddressLauncherWidget
      addressPopup={props.addressPopup}
      customizeOpen={props.customizeOpen}
      localeId={props.localeId}
      navigation={props.navigation}
      onOpenAddress={props.onOpenAddress}
    />
  </section>
{:else if props.id === "trust"}
  <TrustWidget
    browserTools={props.browserTools}
    customizeOpen={props.customizeOpen}
    edge={props.edge}
    localeId={props.localeId}
    navigation={props.navigation}
    onFatalError={props.onFatalError}
    shell={props.shell}
  />
{:else if props.id === "application-menu" || props.id === "extensions" || props.id === "settings" || props.id === "show-bookmarks" || props.id === "show-downloads" || props.id === "show-translate"}
  <BrowserToolWidget
    browserTools={props.browserTools}
    customizeOpen={props.customizeOpen}
    edge={props.edge}
    id={props.id}
    localeId={props.localeId}
    onDismiss={props.onDismiss}
    onFatalError={props.onFatalError}
    onRevealProject={props.onRevealProject}
    shell={props.shell}
  />
{:else if props.id === "close-window" || props.id === "minimize-window" || props.id === "toggle-maximize-window"}
  <WindowControlWidget
    customizeOpen={props.customizeOpen}
    id={props.id}
    localeId={props.localeId}
    onFatalError={props.onFatalError}
    windowControls={props.windowControls}
  />
{:else if props.id === "bookmarks" || props.id === "downloads-status" || props.id === "tabs"}
  <FeatureWidget
    bookmarks={props.bookmarks}
    direction={props.direction}
    downloads={props.downloads}
    edge={props.edge}
    id={props.id}
    localeId={props.localeId}
    onDismiss={props.onDismiss}
    onFatalError={props.onFatalError}
    shell={props.shell}
    tabs={props.tabs}
  />
{:else}
  <ShellWidget
    canEdit={props.canEdit}
    customizeOpen={props.customizeOpen}
    id={props.id}
    localeId={props.localeId}
    onSetCustomizeOpen={props.onSetCustomizeOpen}
    shell={props.shell}
    windowKind={props.windowKind}
  />
{/if}
