<!-- SPDX-License-Identifier: MPL-2.0 -->
<script lang="ts">
  import type { AddressPopupController } from "../../app/address-popup";
  import {
    type BrowserToolAction,
    type BrowserToolsStateAdapter,
  } from "../../app/browser-tools-state";
  import type { CustomizeSessionController } from "../../app/customize-session";
  import type { EdgeShellController } from "../../app/edge-surfaces";
  import { translate, type MessageKey, type MessageVars } from "../../app/i18n";
  import type { FenneviaLocale } from "../../app/locale-state";
  import {
    createBrowserNavigationState,
    type BrowserNavigationState,
    type BrowserNavigationStateAdapter,
  } from "../../app/navigation-state";
  import type { BrowserTabsStateAdapter } from "../../app/tab-state";
  import type {
    BrowserToolbarWidgetsState,
    BrowserToolbarWidgetsStateAdapter,
  } from "../../app/toolbar-widgets-state";
  import { resolveBrowserToolHost } from "../browser-tool-host";
  import TabStrip from "../features/tabs/TabStrip.svelte";
  import ToolbarWidgetZone from "../features/toolbar-widgets/ToolbarWidgetZone.svelte";
  import {
    getConnectionSecurityPresentation,
    getTrackingProtectionPresentation,
  } from "../navigation-labels";

  type Props = Readonly<{
    addressPopup: AddressPopupController;
    browserTools?: BrowserToolsStateAdapter;
    customizeOpen: boolean;
    customizeSession?: CustomizeSessionController;
    localeId: FenneviaLocale;
    navigation: BrowserNavigationStateAdapter;
    onDismiss: () => void;
    onFatalError: (error: unknown) => void;
    onOpenAddress: () => boolean;
    shell: EdgeShellController;
    tabs: BrowserTabsStateAdapter;
    toolbarWidgets?: BrowserToolbarWidgetsStateAdapter;
    toolbarWidgetsState: BrowserToolbarWidgetsState | null;
  }>;

  const props: Props = $props();
  const t = (key: MessageKey, vars?: MessageVars): string =>
    translate(props.localeId, key, vars);

  let addressPopupVisible = $state(false);
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
  let browserToolsSnapshot = $derived(props.browserTools?.snapshot());
  let connectionStatus = $derived(
    getConnectionSecurityPresentation(
      currentNavigation.snapshot.connectionSecurity,
      props.localeId,
    ),
  );
  let protectionStatus = $derived(
    getTrackingProtectionPresentation(
      currentNavigation.snapshot.trackingProtection,
      props.localeId,
    ),
  );

  $effect(() => {
    currentNavigation = props.navigation.snapshot();
    return props.navigation.subscribe((nextState) => {
      currentNavigation = nextState;
    });
  });

  $effect(() => {
    const updateVisibility = (phase: string) => {
      addressPopupVisible = phase !== "hidden" && phase !== "disposed";
    };
    updateVisibility(props.addressPopup.snapshot().phase);
    return props.addressPopup.subscribe((snapshot) => {
      updateVisibility(snapshot.phase);
    });
  });

  const runBrowserToolAction = async (
    action: BrowserToolAction,
    event: MouseEvent,
  ) => {
    try {
      const browserTools = props.browserTools;
      if (!browserTools) {
        throw new Error("FENNEVIA_BROWSER_TOOLS_UNAVAILABLE");
      }
      props.shell.setPopupHeld("left", true);
      await browserTools.invoke(action, resolveBrowserToolHost(event));
    } catch (error) {
      props.shell.setPopupHeld("left", false);
      if (!props.browserTools) {
        props.onFatalError(error);
      }
    }
  };
</script>

<section
  aria-label={t("nav.launcherAria")}
  class="fennevia-address-launcher"
  data-fennevia-address-launcher-region=""
>
  <div
    class="fennevia-address-launcher__cluster"
    data-fennevia-address-launcher-cluster=""
  >
    <button
      aria-controls="fennevia-address-popup"
      aria-expanded={addressPopupVisible}
      aria-haspopup="dialog"
      aria-label={t("nav.openAddress")}
      class="fennevia-address-launcher__button"
      data-fennevia-address-launcher=""
      data-fennevia-default-focus=""
      onclick={() => props.onOpenAddress()}
      title={t("nav.openAddress")}
      type="button"
    >
      <span aria-hidden="true" class="fennevia-address-launcher__glyph">⌁</span>
      <span class="fennevia-address-launcher__location" dir="auto">
        {currentNavigation.snapshot.addressValue || t("address.placeholder")}
      </span>
    </button>
    <div class="fennevia-address-launcher__indicators">
      <button
        aria-label={t("nav.openSiteInformation", {
          label: connectionStatus.label,
        })}
        class="fennevia-address-launcher__indicator"
        data-fennevia-browser-tool="site-information"
        data-fennevia-connection-status=""
        data-fennevia-status-tone={connectionStatus.tone}
        disabled={!browserToolsSnapshot?.siteInformation}
        onclick={(event) =>
          void runBrowserToolAction("site-information", event)}
        title={t("nav.openSiteInformation", {
          label: connectionStatus.label,
        })}
        type="button">{connectionStatus.badge}</button
      >
      <button
        aria-label={t("nav.openTrackingProtection", {
          label: protectionStatus.label,
        })}
        class="fennevia-address-launcher__indicator"
        data-fennevia-browser-tool="protections"
        data-fennevia-protection-status=""
        data-fennevia-status-tone={protectionStatus.tone}
        disabled={!browserToolsSnapshot?.protections}
        onclick={(event) => void runBrowserToolAction("protections", event)}
        title={t("nav.openTrackingProtection", {
          label: protectionStatus.label,
        })}
        type="button">{protectionStatus.badge}</button
      >
    </div>
  </div>
</section>

<TabStrip
  localeId={props.localeId}
  onFatalError={props.onFatalError}
  shell={props.shell}
  tabs={props.tabs}
/>

<ToolbarWidgetZone
  browserTools={props.browserTools}
  customizeOpen={props.customizeOpen}
  customizeSession={props.customizeSession}
  edge="left"
  localeId={props.localeId}
  onDismiss={() => props.onDismiss()}
  onFatalError={props.onFatalError}
  shell={props.shell}
  state={props.toolbarWidgetsState}
  toolbarWidgets={props.toolbarWidgets}
/>
